#!/bin/bash

echo "Testing DirectPrint V2..."

# 1. Check backend
echo "1. Backend status:"
curl -s http://localhost:3001/api/status | jq

# 2. Check kiosks
echo -e "\n2. Registered kiosks:"
curl -s http://localhost:3001/api/admin/kiosks | jq

# 3. Create test job
echo -e "\n3. Creating test job..."
JOB_RESPONSE=$(curl -s -X POST http://localhost:3001/api/jobs/create \
  -F "file=@test.pdf" \
  -F "kiosk_id=kiosk_main")

echo $JOB_RESPONSE | jq
JOB_ID=$(echo $JOB_RESPONSE | jq -r .job_id)

# 4. Verify payment
echo -e "\n4. Verifying payment for $JOB_ID..."
curl -s -X POST http://localhost:3001/api/jobs/$JOB_ID/verify-payment \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"TEST","payment_signature":"SIG"}' | jq

# 5. Check status
sleep 2
echo -e "\n5. Job status:"
curl -s http://localhost:3001/api/jobs/$JOB_ID/status | jq

echo -e "\n✅ Test complete!"