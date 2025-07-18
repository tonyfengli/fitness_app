# E2E Test Debugging Guide

## Quick Debug for AI Assistant

When E2E tests fail, the AI can check test results by looking at:

1. **Test artifacts location**: `/apps/nextjs/test-results/`
2. **Latest run status**: `.last-run.json` 
3. **Error details**: `{test-name}/error-context.md` files
4. **Screenshots**: `before-test.png`, `before-login.png`, etc.

### To debug with AI:
Just tell the AI: "Check the test results" and it can:
- Read error context files to see page state
- Check file timestamps to confirm latest run
- Analyze what went wrong without needing you to copy/paste

### Example prompt:
"The E2E test failed, can you check what happened?"

The AI will automatically look in the test-results folder and tell you what it finds.