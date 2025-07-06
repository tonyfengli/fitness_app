#!/bin/bash

# Development utilities for the fitness app

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}Port $port is in use${NC}"
        return 0
    else
        echo -e "${GREEN}Port $port is free${NC}"
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Killing processes on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Port $port cleared${NC}"
}

# Function to clean Next.js cache
clean_nextjs() {
    echo -e "${YELLOW}Cleaning Next.js cache...${NC}"
    rm -rf apps/nextjs/.next
    rm -rf apps/nextjs/.turbo
    echo -e "${GREEN}Next.js cache cleaned${NC}"
}

# Function to kill all dev processes
kill_dev_processes() {
    echo -e "${YELLOW}Killing development processes...${NC}"
    pkill -f "next dev" || true
    pkill -f "turbo watch" || true
    pkill -f "expo start" || true
    echo -e "${GREEN}Development processes killed${NC}"
}

# Function to full cleanup
full_cleanup() {
    echo -e "${RED}Performing full cleanup...${NC}"
    kill_dev_processes
    sleep 1
    kill_port 3000
    kill_port 8081  # Expo port
    clean_nextjs
    echo -e "${GREEN}Full cleanup completed${NC}"
}

# Function to check system health
check_health() {
    echo -e "${YELLOW}Checking development environment health...${NC}"
    
    # Check Node version
    node_version=$(node -v)
    echo -e "Node version: $node_version"
    
    # Check pnpm version
    pnpm_version=$(pnpm -v)
    echo -e "pnpm version: $pnpm_version"
    
    # Check ports
    check_port 3000
    check_port 8081
    
    # Check for zombie processes
    zombie_count=$(ps aux | grep -E "(next|turbo|expo)" | grep -v grep | wc -l)
    if [ $zombie_count -gt 0 ]; then
        echo -e "${YELLOW}Found $zombie_count development processes running${NC}"
    else
        echo -e "${GREEN}No zombie processes found${NC}"
    fi
}

# Main script
case "$1" in
    "check")
        check_health
        ;;
    "clean")
        full_cleanup
        ;;
    "kill-port")
        if [ -z "$2" ]; then
            echo "Usage: $0 kill-port <port>"
            exit 1
        fi
        kill_port $2
        ;;
    "restart")
        full_cleanup
        echo -e "${GREEN}Ready to start development server${NC}"
        echo -e "${YELLOW}Run 'pnpm dev' to start${NC}"
        ;;
    *)
        echo "Usage: $0 {check|clean|kill-port|restart}"
        echo ""
        echo "Commands:"
        echo "  check     - Check development environment health"
        echo "  clean     - Clean all caches and kill processes"
        echo "  kill-port - Kill process on specific port"
        echo "  restart   - Full cleanup for fresh restart"
        ;;
esac