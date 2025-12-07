#!/bin/bash
# =============================================================================
# Test Full-Stack Demo Example
# =============================================================================
# This script tests the full-stack demo by:
# 1. Starting the API server
# 2. Testing all API endpoints
# 3. Optionally starting the frontend
# =============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLE_DIR="$PROJECT_ROOT/examples/full-stack-demo"
API_DIR="$EXAMPLE_DIR/api"
FRONTEND_DIR="$EXAMPLE_DIR/frontend"

API_PORT=${API_PORT:-3000}
API_URL="http://localhost:$API_PORT"

echo "=============================================="
echo "  DataSpec Engine - Full-Stack Demo Test"
echo "=============================================="
echo ""

# Check if the example directory exists
if [ ! -d "$EXAMPLE_DIR" ]; then
    echo "ERROR: Example directory not found: $EXAMPLE_DIR"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Install and start API
echo "1. Installing API dependencies..."
cd "$API_DIR"
npm install --silent

echo ""
echo "2. Starting API server on port $API_PORT..."
npm run dev &
API_PID=$!

# Wait for API to be ready
echo "   Waiting for API to start..."
MAX_ATTEMPTS=30
ATTEMPT=0
while ! curl -s "$API_URL/health" > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "   ERROR: API failed to start after $MAX_ATTEMPTS seconds"
        exit 1
    fi
    sleep 1
done
echo "   API is ready!"

echo ""
echo "3. Testing API endpoints..."
echo "----------------------------------------------"

# Test health endpoint
echo ""
echo "   GET /health"
curl -s "$API_URL/health" | head -c 200
echo ""

# Test entities endpoint
echo ""
echo "   GET /dataspec/entities"
ENTITIES_RESPONSE=$(curl -s "$API_URL/dataspec/entities")
echo "$ENTITIES_RESPONSE" | head -c 300
echo ""

# Check if entities response is successful
if echo "$ENTITIES_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Entities endpoint working"
else
    echo "   ✗ Entities endpoint failed"
    exit 1
fi

# Test specs endpoint
echo ""
echo "   GET /dataspec/specs?entity=users"
SPECS_RESPONSE=$(curl -s "$API_URL/dataspec/specs?entity=users")
echo "$SPECS_RESPONSE" | head -c 300
echo ""

if echo "$SPECS_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Specs endpoint working"
else
    echo "   ✗ Specs endpoint failed"
    exit 1
fi

# Test validate endpoint
echo ""
echo "   POST /dataspec/specs/validate"
VALIDATE_RESPONSE=$(curl -s -X POST "$API_URL/dataspec/specs/validate" \
    -H "Content-Type: application/json" \
    -d '{"yamlContent": "version: \"1.0\"\nmetadata:\n  entity: users\ncolumns:\n  - name: test"}')
echo "$VALIDATE_RESPONSE" | head -c 300
echo ""

if echo "$VALIDATE_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Validate endpoint working"
else
    echo "   ✗ Validate endpoint failed"
    exit 1
fi

# Test preview endpoint
echo ""
echo "   POST /dataspec/import/preview"
PREVIEW_RESPONSE=$(curl -s -X POST "$API_URL/dataspec/import/preview" \
    -H "Content-Type: application/json" \
    -d '{
        "specId": "users-import-v1",
        "fileContent": "first_name,last_name,email\nJohn,Doe,john@test.com\nJane,Smith,jane@test.com",
        "fileName": "test.csv"
    }')
echo "$PREVIEW_RESPONSE" | head -c 500
echo ""

if echo "$PREVIEW_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Preview endpoint working"
else
    echo "   ✗ Preview endpoint failed"
    exit 1
fi

# Test mask endpoint
echo ""
echo "   POST /dataspec/mask"
MASK_RESPONSE=$(curl -s -X POST "$API_URL/dataspec/mask" \
    -H "Content-Type: application/json" \
    -d '{"value": "john.doe@example.com", "mode": "partial"}')
echo "$MASK_RESPONSE" | head -c 200
echo ""

if echo "$MASK_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Mask endpoint working"
else
    echo "   ✗ Mask endpoint failed"
    exit 1
fi

echo ""
echo "----------------------------------------------"
echo "All API endpoint tests PASSED!"
echo "=============================================="
echo ""
echo "API is still running at $API_URL"
echo "Press Ctrl+C to stop the server and exit."
echo ""

# Keep running for manual testing
wait $API_PID
