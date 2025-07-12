#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running all tests (Vitest + Playwright)${NC}"
echo "================================================"

# Track if any tests fail
TESTS_FAILED=0

# Function to run tests in parallel
run_parallel_tests() {
    # Run Vitest for unit/integration tests
    echo -e "\n${YELLOW}📦 Running Vitest tests (unit + integration)...${NC}"
    (cd packages/ai && pnpm test) &
    VITEST_PID=$!
    
    # Start dev server for E2E tests
    echo -e "\n${YELLOW}🚀 Starting dev server for E2E tests...${NC}"
    pnpm dev:next > /tmp/next-dev-e2e.log 2>&1 &
    DEV_PID=$!
    
    # Wait for dev server to be ready
    echo "⏳ Waiting for server..."
    MAX_ATTEMPTS=30
    ATTEMPT=0
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server ready${NC}"
            break
        fi
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Server failed to start${NC}"
        kill $VITEST_PID 2>/dev/null
        exit 1
    fi
    
    # Run Playwright E2E tests
    echo -e "\n${YELLOW}🌐 Running Playwright E2E tests...${NC}"
    pnpm playwright test &
    PLAYWRIGHT_PID=$!
    
    # Wait for both test suites to complete
    wait $VITEST_PID
    VITEST_EXIT=$?
    
    wait $PLAYWRIGHT_PID  
    PLAYWRIGHT_EXIT=$?
    
    # Kill dev server
    kill $DEV_PID 2>/dev/null
    pkill -P $DEV_PID 2>/dev/null
    
    # Report results
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}Test Results:${NC}"
    
    if [ $VITEST_EXIT -eq 0 ]; then
        echo -e "  ${GREEN}✅ Vitest: PASSED${NC}"
    else
        echo -e "  ${RED}❌ Vitest: FAILED${NC}"
        TESTS_FAILED=1
    fi
    
    if [ $PLAYWRIGHT_EXIT -eq 0 ]; then
        echo -e "  ${GREEN}✅ Playwright: PASSED${NC}"
    else
        echo -e "  ${RED}❌ Playwright: FAILED${NC}"
        TESTS_FAILED=1
    fi
    
    echo -e "${BLUE}================================================${NC}"
}

# Function to run tests sequentially
run_sequential_tests() {
    # Run Vitest first
    echo -e "\n${YELLOW}📦 Running Vitest tests...${NC}"
    (cd packages/ai && pnpm test)
    VITEST_EXIT=$?
    
    if [ $VITEST_EXIT -ne 0 ]; then
        echo -e "${RED}❌ Vitest tests failed${NC}"
        TESTS_FAILED=1
    else
        echo -e "${GREEN}✅ Vitest tests passed${NC}"
    fi
    
    # Then run Playwright
    echo -e "\n${YELLOW}🌐 Running Playwright E2E tests...${NC}"
    
    # Start dev server
    pnpm dev:next > /tmp/next-dev-e2e.log 2>&1 &
    DEV_PID=$!
    
    # Wait for server
    echo "⏳ Waiting for server..."
    MAX_ATTEMPTS=30
    ATTEMPT=0
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server ready${NC}"
            break
        fi
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    # Run Playwright tests
    pnpm playwright test
    PLAYWRIGHT_EXIT=$?
    
    # Cleanup
    kill $DEV_PID 2>/dev/null
    
    if [ $PLAYWRIGHT_EXIT -ne 0 ]; then
        echo -e "${RED}❌ Playwright tests failed${NC}"
        TESTS_FAILED=1
    else
        echo -e "${GREEN}✅ Playwright tests passed${NC}"
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    pkill -f "next dev" 2>/dev/null
    pkill -f "vitest" 2>/dev/null
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Check command line arguments
if [ "$1" == "--parallel" ] || [ "$1" == "-p" ]; then
    echo "Running tests in parallel..."
    run_parallel_tests
elif [ "$1" == "--sequential" ] || [ "$1" == "-s" ]; then
    echo "Running tests sequentially..."
    run_sequential_tests
else
    # Default to parallel
    echo "Running tests in parallel (use --sequential for sequential execution)..."
    run_parallel_tests
fi

# Exit with failure if any tests failed
exit $TESTS_FAILED