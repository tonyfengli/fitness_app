# Debug Mode

## Overview

The fitness app includes comprehensive debugging tools that are hidden by default to keep the console clean during normal development. Debug mode can be enabled when you need to troubleshoot issues.

## Enabling Debug Mode

There are two ways to enable debug mode:

### 1. Via Browser Console
```javascript
// Enable debug mode
localStorage.setItem('debug', 'true');
// Then refresh the page

// Or use the helper function (if available)
setDebugMode(true);
```

### 2. Via URL Parameter
Add `?debug=true` to any URL:
```
http://localhost:3000/trainer-dashboard?debug=true
```

## Disabling Debug Mode

```javascript
// Via console
localStorage.removeItem('debug');
// Then refresh the page

// Or use the helper function
setDebugMode(false);
```

## What Debug Mode Enables

When debug mode is enabled, you'll see:

1. **Frontend Debug Client Messages**
   - Component state changes
   - Auth flow tracking
   - Navigation events

2. **Block System Debug**
   - Exercise filtering operations
   - Block assignment logic
   - Performance metrics

3. **tRPC Query Logging**
   - All API calls and responses
   - Request/response timing
   - Error details

4. **Debug Command Availability Messages**
   - Notifications about available debug commands
   - Instructions for using debug tools

## Available Debug Commands

Once debug mode is enabled, these commands become available in the browser console:

- `window.frontendDebug.printLogs()` - Print all captured logs
- `window.frontendDebug.downloadReport()` - Download debug report as JSON
- `window.frontendDebug.clear()` - Clear debug logs
- `debugAuth()` - Generate auth debugging report
- `enableAutoCapture()` - Auto-capture navigation events
- `blockDebug.enable()` - Enable block system debugging
- `blockDebug.logToConsole()` - Print block system logs

## Performance Note

Debug mode is disabled by default because logging can impact performance, especially during rapid state changes or heavy API usage. Enable it only when actively debugging issues.