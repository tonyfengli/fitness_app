#!/bin/bash

# Default test credentials - you should change these to match your test user
export TEST_TRAINER_EMAIL="test-trainer@example.com"
export TEST_TRAINER_PASSWORD="test-password"

echo "🧪 Running E2E tests with authentication..."
echo "📧 Test user: $TEST_TRAINER_EMAIL"
echo ""
echo "⚠️  Make sure you have created a test user with these credentials!"
echo "   You can create one by:"
echo "   1. Running the app: pnpm dev:next"
echo "   2. Going to /signup"
echo "   3. Creating a trainer account with the above credentials"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Run the tests
pnpm playwright test