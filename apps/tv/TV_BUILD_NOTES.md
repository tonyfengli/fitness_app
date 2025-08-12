# TV App Build Notes - NativeWind v2 Setup

## Critical: Tailwind/PostCSS Version Lock

This TV app uses **NativeWind v2.0.11** which requires specific versions of Tailwind CSS and PostCSS to work correctly.

### Why These Specific Versions?

NativeWind v2's Babel transform runs PostCSS **synchronously** using `.process(css).css`. Newer versions of Tailwind CSS (3.3+) include async PostCSS plugins, which causes the following error during build:

```
Error: Use process(css).then(cb) to work with async plugins
```

### Required Versions

- **tailwindcss**: 3.2.7 (last version before async plugins)
- **postcss**: 8.4.21 - 8.5.x (NativeWind bundles 8.5.6)
- **nativewind**: 2.0.11

These versions are locked in `package.json` using the `overrides` field.

## Do's and Don'ts

### ✅ DO:

- Keep `tailwind.config.js` in CommonJS format
- Keep content globs tight in tailwind.config.js
- Use className prop directly on React Native components
- Run `pnpm run guard:deps` to verify versions before building
- Use `pnpm install --frozen-lockfile` in CI

### ❌ DON'T:

- Add any `postcss.config.*` files in the TV app
- Import CSS files (this is React Native, not web)
- Upgrade Tailwind CSS or PostCSS without testing
- Use `pnpm update` without checking the TV app specifically
- Mix NativeWind v2 with NativeWind v4 syntax

## Build Commands

```bash
# Development
pnpm run android:tv

# Check dependency versions
pnpm run guard:deps

# Production build
pnpm run build

# Clean build
pnpm run clean
pnpm run clean:android
```

## Troubleshooting

### PostCSS Async Plugin Error

If you see "Use process(css).then(cb) to work with async plugins":

1. Run `pnpm run guard:deps` to check versions
2. Check `pnpm why tailwindcss` and `pnpm why postcss`
3. Ensure no postcss.config.js exists in apps/tv
4. Clear caches: `npx react-native start --reset-cache`

### Tailwind Classes Not Working

1. Ensure babel.config.js includes `'nativewind/babel'`
2. Check that the component uses `className` not `style`
3. Restart Metro bundler with cache clear
4. Verify tailwind.config.js content paths are correct

### Version Drift

The `guard:deps` script runs automatically before builds. If it fails:

```bash
# Check what versions are actually resolved
pnpm why tailwindcss
pnpm why postcss

# Force correct versions
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Safe Upgrade Path (Future)

If you need to test newer Tailwind versions:

1. Create a branch
2. Update versions in package.json (both dependencies and overrides)
3. Run a test bundle: `pnpm run build`
4. If successful, test the app thoroughly
5. If it fails with async plugin error, revert

## Alternative Solutions

If version constraints become too limiting:

1. **NativeWind v4**: Complete rewrite, different API, but supports latest Tailwind
2. **tailwind-rn**: PostCSS-free alternative
3. **Custom solution**: Write a Tailwind-to-StyleSheet converter
4. **Styled Components**: Different approach, no Tailwind

## Related Files

- `package.json` - Version locks and overrides
- `scripts/guardDeps.js` - Version verification script
- `babel.config.js` - NativeWind babel plugin
- `tailwind.config.js` - Tailwind configuration
- `metro.config.js` - Metro bundler configuration