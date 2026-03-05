// pi-agent/modules/scanner.js
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

class Scanner {
  constructor(printerIP, logger) {
    this.printerIP = printerIP;
    this.baseURL = `http://${printerIP}/eSCL`;
    this.logger = logger;
    this.capabilities = null;
  }

  // Fetch scanner capabilities
  async getCapabilities() {
    try {
      const response = await axios.get(`${this.baseURL}/ScannerCapabilities`, {
        timeout: 5000
      });
      
      const result = await xml2js.parseStringPromise(response.data);
      this.capabilities = result;
      
      this.logger.info('✓ Scanner capabilities fetched');
      return this.capabilities;
    } catch (error) {
      throw new Error(`Scanner discovery failed: ${error.message}`);
    }
  }

  // Create scan job
  async createScanJob(options = {}) {
    const {
      resolution = 300,  // DPI
      colorMode = 'RGB24',  // RGB24, Grayscale8, BlackAndWhite1
      format = 'application/pdf',
      width = 2480,   // A4 width at 300 DPI
      height = 3508   // A4 height at 300 DPI
    } = options;

    const scanSettings = `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:Height>${height}</pwg:Height>
      <pwg:Width>${width}</pwg:Width>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
  <scan:ColorMode>${colorMode}</scan:ColorMode>
  <scan:XResolution>${resolution}</scan:XResolution>
  <scan:YResolution>${resolution}</scan:YResolution>
  <pwg:DocumentFormat>${format}</pwg:DocumentFormat>
</scan:ScanSettings>`;

    try {
      const response = await axios.post(`${this.baseURL}/ScanJobs`, scanSettings, {
        headers: { 'Content-Type': 'text/xml' },
        maxRedirects: 0,
        validateStatus: status => status === 201
      });

      // Extract job location from header
      const jobLocation = response.headers.location;
      const jobId = jobLocation.split('/').pop();

      this.logger.info(`✓ Scan job created: ${jobId}`);
      return jobId;
    } catch (error) {
      throw new Error(`Failed to create scan job: ${error.message}`);
    }
  }

  // Retrieve scanned document
  async retrieveDocument(jobId, outputPath) {
    const documentURL = `${this.baseURL}/ScanJobs/${jobId}/NextDocument`;

    try {
      // Poll for document (may take a few seconds)
      let attempts = 0;
      while (attempts < 30) {  // 30 seconds timeout
        try {
          const response = await axios.get(documentURL, {
            responseType: 'stream',
            timeout: 10000
          });

          // Save to file
          const writer = fs.createWriteStream(outputPath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          this.logger.info(`✓ Document saved: ${outputPath}`);
          return outputPath;
        } catch (error) {
          if (error.response?.status === 404) {
            // Document not ready yet, wait and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            continue;
          }
          throw error;
        }
      }

      throw new Error('Scan timeout - document not received');
    } catch (error) {
      throw new Error(`Failed to retrieve document: ${error.message}`);
    }
  }

  // Complete scan workflow
  async scan(options, outputDir) {
    try {
      this.logger.info('🔍 Starting scan...');

      // Ensure scanner is available
      if (!this.capabilities) {
        await this.getCapabilities();
      }

      // Create scan job
      const jobId = await this.createScanJob(options);

      // Retrieve scanned document
      const timestamp = Date.now();
      const outputPath = path.join(outputDir, `scan_${timestamp}.pdf`);
      await this.retrieveDocument(jobId, outputPath);

      return outputPath;
    } catch (error) {
      throw new Error(`Scan failed: ${error.message}`);
    }
  }
}

module.exports = Scanner;
