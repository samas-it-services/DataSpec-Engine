#!/bin/bash
# =============================================================================
# Test DataSpec API Endpoints
# =============================================================================
# This script tests all DataSpec API endpoints against a running server.
# Usage: ./test-api.sh [base_url]
# Default: http://localhost:3000
# =============================================================================

set -e  # Exit on error

BASE_URL=${1:-http://localhost:3000}
PASSED=0
FAILED=0

echo "=============================================="
echo "  DataSpec Engine - API Endpoint Tests"
echo "=============================================="
echo "  Base URL: $BASE_URL"
echo "=============================================="
echo ""

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected=$4
    local description=$5

    echo -n "Testing: $description... "

    if [ "$method" == "GET" ]; then
        RESPONSE=$(curl -s "$BASE_URL$endpoint")
    else
        RESPONSE=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    if echo "$RESPONSE" | grep -q "$expected"; then
        echo "PASSED"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo "FAILED"
        echo "  Expected to find: $expected"
        echo "  Response: $(echo $RESPONSE | head -c 200)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Check if server is running
echo "Checking server availability..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "ERROR: Server not available at $BASE_URL"
    echo "Please start the API server first."
    exit 1
fi
echo "Server is available."
echo ""

echo "----------------------------------------------"
echo "Running endpoint tests..."
echo "----------------------------------------------"
echo ""

# Health check
test_endpoint "GET" "/health" "" '"status":"ok"' "GET /health"

# List entities
test_endpoint "GET" "/dataspec/entities" "" '"success":true' "GET /dataspec/entities"

# List entities with spec count
test_endpoint "GET" "/dataspec/entities?includeSpecCount=true" "" '"success":true' "GET /dataspec/entities?includeSpecCount=true"

# List specs
test_endpoint "GET" "/dataspec/specs" "" '"success":true' "GET /dataspec/specs"

# List specs by entity
test_endpoint "GET" "/dataspec/specs?entity=users" "" '"success":true' "GET /dataspec/specs?entity=users"

# Validate YAML - valid
test_endpoint "POST" "/dataspec/specs/validate" \
    '{"yamlContent": "version: \"1.0\"\nmetadata:\n  entity: users\ncolumns:\n  - name: test"}' \
    '"valid":true' \
    "POST /dataspec/specs/validate (valid YAML)"

# Validate YAML - invalid
test_endpoint "POST" "/dataspec/specs/validate" \
    '{"yamlContent": "invalid yaml without required fields"}' \
    '"valid":false' \
    "POST /dataspec/specs/validate (invalid YAML)"

# Preview import
test_endpoint "POST" "/dataspec/import/preview" \
    '{"specId": "users-import-v1", "fileContent": "first_name,last_name,email\nJohn,Doe,john@test.com", "fileName": "test.csv"}' \
    '"success":true' \
    "POST /dataspec/import/preview"

# Preview import with multiple rows
test_endpoint "POST" "/dataspec/import/preview" \
    '{"specId": "users-import-v1", "fileContent": "first_name,last_name,email\nJohn,Doe,john@test.com\nJane,Smith,jane@test.com\nBob,Johnson,bob@test.com", "fileName": "test.csv", "maxRows": 10}' \
    '"totalRows":3' \
    "POST /dataspec/import/preview (multiple rows)"

# Mask value - partial mode
test_endpoint "POST" "/dataspec/mask" \
    '{"value": "john.doe@example.com", "mode": "partial"}' \
    '"maskedValue"' \
    "POST /dataspec/mask (partial)"

# Mask value - full mode
test_endpoint "POST" "/dataspec/mask" \
    '{"value": "secret-password-123", "mode": "full"}' \
    '"maskedValue"' \
    "POST /dataspec/mask (full)"

# Execute import
test_endpoint "POST" "/dataspec/import/execute" \
    '{"specId": "users-import-v1", "fileContent": "first_name,last_name,email\nTest,User,test@example.com", "fileName": "test.csv"}' \
    '"inserted"' \
    "POST /dataspec/import/execute"

# Export data
test_endpoint "POST" "/dataspec/export" \
    '{"entity": "users", "format": "json", "applyMasking": true}' \
    '"success":true' \
    "POST /dataspec/export (JSON)"

echo ""
echo "----------------------------------------------"
echo "Test Results"
echo "----------------------------------------------"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $((PASSED + FAILED))"
echo "----------------------------------------------"

if [ $FAILED -gt 0 ]; then
    echo "Some tests FAILED!"
    exit 1
else
    echo "All tests PASSED!"
    exit 0
fi
