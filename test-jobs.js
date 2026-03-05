const { Client } = require("pg")
const crypto = require("crypto")

const client = new Client({
  user: "printuser",
  host: "localhost",
  database: "printkiosk",
  password: "",
  port: 5432,
})

const kioskId = "TEST_KIOSK_1"

function newId() {
  return crypto.randomUUID()
}

async function insertJob(status, extra = {}) {
  const id = newId()

  await client.query(
    `
    INSERT INTO jobs (
      id,
      kiosk_id,
      filename,
      file_path,
      pages,
      price_per_page,
      total_cost,
      status,
      payment_status,
      metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `,
    [
      id,
      kioskId,
      "test.pdf",
      "/tmp/test.pdf",
      3,
      2,
      6,
      status,
      "paid",
      JSON.stringify(extra),
    ]
  )

  console.log("Inserted job:", id, "status:", status)
}

async function runTests() {
  await client.connect()

  console.log("\n==== TEST 1: Normal Job ====")
  await insertJob("QUEUED")

  console.log("\n==== TEST 2: Retry Job ====")
  await insertJob("QUEUED", { simulateFailure: true })

  console.log("\n==== TEST 3: Stuck Job Recovery ====")

  const id = newId()

  await client.query(
    `
    INSERT INTO jobs (
      id,
      kiosk_id,
      filename,
      file_path,
      pages,
      price_per_page,
      total_cost,
      status,
      payment_status,
      last_status_update
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,'PRINTING','paid', NOW() - INTERVAL '10 minutes')
  `,
    [
      id,
      kioskId,
      "stuck.pdf",
      "/tmp/test.pdf",
      2,
      2,
      4
    ]
  )

  console.log("Inserted stuck PRINTING job:", id)

  console.log("\n==== TEST 4: Failed Job ====")
  await insertJob("FAILED")

  console.log("\nAll tests inserted.")
  process.exit()
}

runTests()
