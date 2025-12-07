#!/bin/bash
# =============================================================================
# Test Basic Import Example
# =============================================================================
# This script tests the basic-import example by running the Node.js script
# that demonstrates CSV import using the DataSpec Engine core package.
# =============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLE_DIR="$PROJECT_ROOT/examples/basic-import"

echo "=============================================="
echo "  DataSpec Engine - Basic Import Example Test"
echo "=============================================="
echo ""

# Check if the example directory exists
if [ ! -d "$EXAMPLE_DIR" ]; then
    echo "ERROR: Example directory not found: $EXAMPLE_DIR"
    exit 1
fi

cd "$EXAMPLE_DIR"

echo "1. Installing dependencies..."
npm install --silent

echo ""
echo "2. Running basic import example..."
echo "----------------------------------------------"
npm start

echo ""
echo "----------------------------------------------"
echo "Basic import example test PASSED!"
echo "=============================================="
