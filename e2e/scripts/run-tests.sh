#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 Starting E2E test runner..."

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Stopping all processes...${NC}"
    # Kill the dev server
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null
        # Also kill any child processes
        pkill -P $DEV_PID 2>/dev/null
    fi
    # Clean up any hanging Next.js processes
    pkill -f "next dev" 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}❌ Port 3000 is already in use${NC}"
    echo "Would you like to kill the process? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        lsof -ti:3000 | xargs kill -9
        echo "✅ Killed process on port 3000"
        sleep 2
    else
        echo "Please free up port 3000 and try again"
        exit 1
    fi
fi

# Start the dev server in the background
echo -e "${GREEN}🔧 Starting development server...${NC}"
pnpm dev:next > /tmp/next-dev.log 2>&1 &
DEV_PID=$!

# Wait for the server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "\n${RED}❌ Server failed to start. Check /tmp/next-dev.log for errors${NC}"
    exit 1
fi

# Run the tests
echo -e "\n${GREEN}🧪 Running E2E tests...${NC}"

# Check if we should run in UI mode
if [ "$1" == "--ui" ]; then
    pnpm playwright test --ui
elif [ "$1" == "--headed" ]; then
    pnpm playwright test --headed
else
    pnpm playwright test
fi

# Capture test exit code
TEST_EXIT_CODE=$?

# The cleanup function will handle stopping the server
exit $TEST_EXIT_CODE