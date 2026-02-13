#!/bin/bash
# test-system.sh - Quick system verification script

echo "🧪 DirectPrint System Test"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend
echo "1️⃣  Testing Backend..."
BACKEND_RESPONSE=$(curl -s http://localhost:3001/api/status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Backend is running"
    echo "   Response: $BACKEND_RESPONSE"
else
    echo -e "${RED}✗${NC} Backend is NOT running"
    echo "   Start it with: cd backend && npm start"
fi
echo ""

# Test 2: CUPS
echo "2️⃣  Testing CUPS..."
if command -v lpstat &> /dev/null; then
    echo -e "${GREEN}✓${NC} CUPS is installed"
    
    PRINTERS=$(lpstat -p 2>/dev/null)
    if [ ! -z "$PRINTERS" ]; then
        echo -e "${GREEN}✓${NC} Printers detected:"
        echo "$PRINTERS" | sed 's/^/   /'
    else
        echo -e "${YELLOW}⚠${NC} No printers found"
        echo "   Connect a printer and run: lpstat -p"
    fi
else
    echo -e "${RED}✗${NC} CUPS is NOT installed"
    echo "   Install with: sudo apt install cups"
fi
echo ""

# Test 3: Pi Agent
echo "3️⃣  Testing Pi Agent..."
if pgrep -f "node.*pi-agent" > /dev/null || pgrep -f "directprint.*agent" > /dev/null; then
    echo -e "${GREEN}✓${NC} Pi Agent is running"
    
    # Check if connected to backend
    sleep 1
    BACKEND_STATUS=$(curl -s http://localhost:3001/api/status 2>/dev/null)
    if echo "$BACKEND_STATUS" | grep -q '"connected":true'; then
        echo -e "${GREEN}✓${NC} Agent connected to backend"
    else
        echo -e "${YELLOW}⚠${NC} Agent might not be connected yet (give it a few seconds)"
    fi
else
    echo -e "${RED}✗${NC} Pi Agent is NOT running"
    echo "   Start it with: cd pi-agent && npm start"
fi
echo ""

# Test 4: Frontend
echo "4️⃣  Testing Frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is running"
else
    echo -e "${RED}✗${NC} Frontend is NOT running"
    echo "   Start it with: cd frontend && npm run dev"
fi
echo ""

# Test 5: Node.js version
echo "5️⃣  System Requirements..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
    
    # Check if version is >= 16
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ $NODE_MAJOR -ge 16 ]; then
        echo -e "${GREEN}✓${NC} Version requirement met (>=16)"
    else
        echo -e "${YELLOW}⚠${NC} Node.js version is old. Recommended: v16+"
    fi
else
    echo -e "${RED}✗${NC} Node.js is NOT installed"
fi
echo ""

# Summary
echo "=========================="
echo "📊 Summary"
echo "=========================="
echo ""
echo "Next steps:"
echo "1. If backend is down: cd backend && npm start"
echo "2. If agent is down: cd pi-agent && npm start"  
echo "3. If frontend is down: cd frontend && npm run dev"
echo "4. Generate QR code at: https://qr.munb.me/json-qr"
echo "5. Access frontend at: http://localhost:5173"
echo ""
echo "Full test flow:"
echo "  Frontend → Scan QR → Upload PDF → See price → Print"
echo ""