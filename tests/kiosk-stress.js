const axios = require("axios");

const SERVER = "http://localhost:3001";
const KIOSKS = 2;

async function pollKiosk(id) {
  try {
    const res = await axios.get(`${SERVER}/api/kiosk/status`, {
      params: { kiosk_id: id }
    });

    console.log(id, res.data);
  } catch (err) {
    console.log(id, "ERROR", err.response?.data || err.message);
  }
}

async function run() {
  console.log("\n==== Kiosk Stress Test ====\n");

  const kiosks = [];

  for (let i = 0; i < KIOSKS; i++) {
    const id = `TEST_KIOSK_${i}`;
    kiosks.push(pollKiosk(id));
  }

  await Promise.all(kiosks);

  console.log("\nDone\n");
}

run();