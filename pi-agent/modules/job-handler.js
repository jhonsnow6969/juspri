// pi-agent/modules/job-handler.js
// Job polling, downloading, conversion, scanning and print execution

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const { JobError } = require("./errors");
const utils = require("./utils");
const printer = require("./printer");
const Scanner = require("./scanner");

let scanner = null;

// ==================== INITIALIZATION ====================

function initScanner(printerIP, logger) {
  scanner = new Scanner(printerIP, logger);
  logger.info("✓ Scanner initialized");
}

function ensureTempDir() {
  const dir = "./print-queue";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ==================== JOB POLLING ====================

function getDirectorySizeMB(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let totalBytes = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    try {
      const stats = fs.statSync(path.join(dirPath, file));
      if (stats.isFile()) totalBytes += stats.size;
    } catch {}
  }
  return totalBytes / (1024 * 1024);
}

async function pollForJobs(cloudServer, kioskId, state, socket, logger) {
  if (!socket.connected) {
    logger.debug("Not connected to cloud, skipping poll");
    return;
  }

  if (state.currentJob) {
    logger.debug(`Skipping poll - job ${state.currentJob} in progress`);
    return;
  }

  state.pollCount++;
  state.lastPollTime = new Date().toISOString();

  try {
    const response = await axios.get(`${cloudServer}/api/jobs/poll`, {
      params: { kiosk_id: kioskId },
      timeout: 10000,
    });

    if (response.data.jobs && response.data.jobs.length > 0) {
      const jobs = response.data.jobs;
      state.jobsFetchedToday += jobs.length;

      for (const job of jobs) {
        state.pendingJobs.set(job.job_id, job);
      }

      if (!state.currentJob && state.pendingJobs.size > 0) {
        const firstJobId = state.pendingJobs.keys().next().value;
        const job = state.pendingJobs.get(firstJobId);

        if (job.job_type === "scan") {
          await processScanJob(firstJobId, cloudServer, state, socket, logger);
        } else {
          await processJob(firstJobId, state, socket, logger);
        }
      }
    }
  } catch (error) {
    if (error.code !== "ECONNABORTED") {
      logger.debug(`Poll error: ${error.message}`);
    }
  }
}

// ==================== PRINT JOB PROCESSING ====================

async function processJob(jobId, state, socket, logger) {
  const job = state.pendingJobs.get(jobId);

  if (!job) {
    logger.warn(`Job ${jobId} not found`);
    return;
  }

  ensureTempDir();

  const tempDir = "./print-queue";
  state.currentJob = jobId;

  try {
    logger.info(`\n[Poll] New print job: ${jobId}`);
    logger.info(`   File: ${job.filename}`);
    logger.info(`   Pages: ${job.pages}`);

    // Disk protection: check queue size before downloading
    const queueSizeMB = getDirectorySizeMB(tempDir);
    if (queueSizeMB > 500) {
      logger.error(`Queue dir ${queueSizeMB.toFixed(0)}MB > 500MB limit, skipping job`);
      return;
    }

    const originalPath = path.join(tempDir, `${jobId}_${job.filename}`);

    // Stream download instead of base64
    const downloadUrl = job.download_url;
    if (!downloadUrl) {
      throw new JobError('No download_url in job data', jobId);
    }

    const cloudServer = state._cloudServer;
    const response = await axios({
      url: `${cloudServer}${downloadUrl}`,
      method: 'GET',
      responseType: 'stream',
      timeout: 60000
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(originalPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const fileSize = fs.statSync(originalPath).size;
    logger.info(`   ✓ File downloaded (${(fileSize / 1024).toFixed(1)} KB)`);

    if (socket.connected) {
      socket.emit("job_received", { job_id: jobId });
    }

    const fileType = utils.getFileType(job.filename);

    logger.info(`   File type: ${fileType}`);

    let finalPdfPath = originalPath;

    if (fileType === "document") {
      state.conversionsToday++;
      finalPdfPath = await utils.convertDocumentToPDF(originalPath, logger);
    } else if (fileType === "image") {
      state.conversionsToday++;
      finalPdfPath = await utils.convertImageToPDF(originalPath, logger);
    } else if (fileType === "pdf") {
      await utils.verifyPDF(originalPath, job.pages, logger);
    } else {
      throw new JobError(`Unsupported file type: ${fileType}`, jobId);
    }

    if (socket.connected) {
      socket.emit("print_started", { job_id: jobId });
    }

    const printResult = await printer.printDocument(
      state.printerName,
      finalPdfPath,
      job.pages,
      logger,
    );

    if (socket.connected) {
      socket.emit("print_complete", {
        job_id: jobId,
        success: true,
        pages_printed: printResult.pages,
      });
    }

    logger.success(`✓ Job ${jobId} completed`);

    setTimeout(() => {
      try {
        if (fs.existsSync(finalPdfPath)) fs.unlinkSync(finalPdfPath);

        if (originalPath !== finalPdfPath && fs.existsSync(originalPath)) {
          fs.unlinkSync(originalPath);
        }

        logger.info("🗑 Temp files cleaned");
      } catch (err) {
        logger.warn(`Cleanup error: ${err.message}`);
      }
    }, 5000);
  } catch (error) {
    logger.error(`Print error: ${error.message}`);

    if (socket.connected) {
      socket.emit("print_complete", {
        job_id: jobId,
        success: false,
        error: error.message,
      });
    }
  } finally {
    state.currentJob = null;
    state.pendingJobs.delete(jobId);

    if (state.pendingJobs.size > 0) {
      const nextJobId = state.pendingJobs.keys().next().value;
      logger.info(`→ Next job: ${nextJobId}`);

      await processJob(nextJobId, state, socket, logger);
    }
  }
}

// ==================== SCAN JOB ====================

async function processScanJob(jobId, cloudServer, state, socket, logger) {
  const job = state.pendingJobs.get(jobId);

  if (!job) return;

  ensureTempDir();

  state.currentJob = jobId;

  try {
    logger.info(`📄 Scan job received: ${jobId}`);

    socket.emit("job_state_change", {
      job_id: jobId,
      status: "DISCOVERING_SCANNER",
      status_message: "Detecting scanner",
    });

    const scanOptions = {
      resolution: job.scan_options?.resolution || 300,
      colorMode: job.scan_options?.colorMode || "RGB24",
      format: job.scan_options?.format || "application/pdf",
    };

    socket.emit("job_state_change", {
      job_id: jobId,
      status: "SCANNING",
      status_message: "Scanning document",
    });

    const scanOutputPath = await scanner.scan(scanOptions, "./print-queue");

    socket.emit("job_state_change", {
      job_id: jobId,
      status: "PROCESSING",
      status_message: "Processing scan",
    });

    const FormData = require("form-data");

    const form = new FormData();
    form.append("file", fs.createReadStream(scanOutputPath));
    form.append("job_id", jobId);

    await axios.post(`${cloudServer}/api/jobs/${jobId}/scan-upload`, form, {
      headers: form.getHeaders(),
    });

    socket.emit("scan_complete", {
      job_id: jobId,
      success: true,
    });

    logger.info(`✓ Scan uploaded`);

    fs.unlinkSync(scanOutputPath);
  } catch (error) {
    logger.error(`Scan failed: ${error.message}`);

    socket.emit("scan_complete", {
      job_id: jobId,
      success: false,
      error: error.message,
    });
  } finally {
    state.currentJob = null;
    state.pendingJobs.delete(jobId);
  }
}

// ==================== POLLING INTERVAL ====================

function startPolling(
  cloudServer,
  kioskId,
  pollInterval,
  state,
  socket,
  logger,
) {
  logger.info(`🔄 Polling every ${pollInterval / 1000}s`);

  setTimeout(() => {
    logger.info("Starting job polling...");
    pollForJobs(cloudServer, kioskId, state, socket, logger);
  }, 2000);

  const intervalId = setInterval(() => {
    pollForJobs(cloudServer, kioskId, state, socket, logger);
  }, pollInterval);

  return intervalId;
}

// ==================== EXPORTS ====================

module.exports = {
  pollForJobs,
  processJob,
  processScanJob,
  startPolling,
  initScanner,
};
