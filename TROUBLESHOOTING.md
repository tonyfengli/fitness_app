# Troubleshooting Guide

## Common Issues and Solutions

### 1. Infinite Loading / Server Not Responding

**Symptoms:**
- Browser shows infinite loading spinner
- `localhost:3000` doesn't respond
- Terminal shows server is running but no response

**Causes:**
- Zombie Node.js processes from previous runs
- Port 3000 already in use
- Corrupted Next.js cache
- Database connection timeout

**Solutions:**

#### Quick Fix:
```bash
# Use the new cleanup command
pnpm dev:clean

# Or manually:
pnpm clean:dev && pnpm dev
```

#### Full Cleanup:
```bash
# Use the dev utilities script
./scripts/dev-utils.sh clean

# Then restart
pnpm dev
```

#### Check Environment Health:
```bash
./scripts/dev-utils.sh check
```

### 2. Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Kill specific port
pnpm kill:port

# Or use the utility script
./scripts/dev-utils.sh kill-port 3000
```

### 3. Database Connection Issues

**Symptoms:**
- App loads but shows database errors
- Cannot fetch data

**Solutions:**
1. Check your `.env` file has correct `POSTGRES_URL`
2. Ensure the database is accessible (check Supabase dashboard)
3. Try restarting the database connection pool in Supabase

### 4. Build/Type Errors

**Solution:**
```bash
# Clean all caches
pnpm clean

# Reinstall dependencies
pnpm install

# Run type check
pnpm typecheck
```

## Preventive Measures

### 1. Always Clean Exit
- Use `Ctrl+C` to stop the dev server
- Wait for "Gracefully shutting down" message
- Don't force quit the terminal

### 2. Regular Cleanup
```bash
# Before starting work each day
./scripts/dev-utils.sh check

# If issues found
./scripts/dev-utils.sh clean
```

### 3. Use Helper Commands
- `pnpm dev:clean` - Clean start
- `pnpm dev:restart` - Full restart with cleanup
- `pnpm clean:dev` - Just cleanup (no start)

### 4. Monitor Resources
- Check Activity Monitor (Mac) or Task Manager (Windows) for hanging Node processes
- Look for high CPU usage from `next-server` processes

## Emergency Reset

If nothing else works:
```bash
# Nuclear option - kills ALL Node processes
pkill -9 -f node

# Clean everything
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf apps/*/.next
rm -rf apps/*/.turbo
pnpm install
pnpm dev
```

## Getting Help

1. Check the terminal output for specific error messages
2. Look at browser console (F12) for client-side errors
3. Run `./scripts/dev-utils.sh check` for environment diagnosis
4. Check the [Next.js documentation](https://nextjs.org/docs) for framework-specific issues