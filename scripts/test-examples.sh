#!/bin/bash
# =============================================================================
# Test All DataSpec Engine Examples
# =============================================================================
# Master script to test all example projects:
# 1. Basic Import Example (CLI)
# 2. Full-Stack Demo (API + React)
# 3. API Endpoints
# =============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "  DataSpec Engine - Example Tests"
echo "=============================================="
echo "  Project Root: $PROJECT_ROOT"
echo "=============================================="
echo ""

# Track results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local name=$1
    local script=$2

    TESTS_RUN=$((TESTS_RUN + 1))

    echo ""
    echo "=============================================="
    echo "  Running: $name"
    echo "=============================================="

    if bash "$script"; then
        echo ""
        echo "  Result: PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo ""
        echo "  Result: FAILED"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Parse command line arguments
RUN_BASIC=false
RUN_FULLSTACK=false
RUN_API=false
RUN_ALL=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --basic)
            RUN_BASIC=true
            RUN_ALL=false
            shift
            ;;
        --fullstack)
            RUN_FULLSTACK=true
            RUN_ALL=false
            shift
            ;;
        --api)
            RUN_API=true
            RUN_ALL=false
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --basic      Run basic-import example test only"
            echo "  --fullstack  Run full-stack demo test only"
            echo "  --api        Run API endpoint tests only"
            echo "  --help       Show this help message"
            echo ""
            echo "Without options, all tests will run."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run tests based on selection
if [ "$RUN_ALL" = true ] || [ "$RUN_BASIC" = true ]; then
    # Note: Basic import test requires core package to be built
    echo ""
    echo "NOTE: Skipping basic-import test (requires core package to be built)"
    echo "To run manually: cd examples/basic-import && npm install && npm start"
    # run_test "Basic Import Example" "$SCRIPT_DIR/test-basic-import.sh"
fi

if [ "$RUN_ALL" = true ] || [ "$RUN_FULLSTACK" = true ]; then
    run_test "Full-Stack Demo" "$SCRIPT_DIR/test-fullstack-demo.sh"
fi

if [ "$RUN_ALL" = true ] || [ "$RUN_API" = true ]; then
    # API tests run as part of fullstack demo
    # Can also be run separately against any running server
    echo ""
    echo "NOTE: API tests included in Full-Stack Demo test"
    echo "To run against a different server: ./scripts/test-api.sh http://your-server:port"
fi

# Print summary
echo ""
echo "=============================================="
echo "  Test Summary"
echo "=============================================="
echo "  Tests Run:    $TESTS_RUN"
echo "  Tests Passed: $TESTS_PASSED"
echo "  Tests Failed: $TESTS_FAILED"
echo "=============================================="

if [ $TESTS_FAILED -gt 0 ]; then
    echo ""
    echo "Some tests FAILED!"
    exit 1
else
    echo ""
    echo "All tests PASSED!"
    exit 0
fi
