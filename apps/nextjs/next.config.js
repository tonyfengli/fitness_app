import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/auth",
    "@acme/db",
    "@acme/ui-shared",
    "@acme/ui-desktop",
    "@acme/ui-mobile",
    "@acme/validators",
    "react-native",
    "react-native-web",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  /** Celebration cards draw text from bundled fonts (src/lib/celebrations/text.ts); ship them with the functions */
  outputFileTracingIncludes: {
    "/api/cron/celebrations": ["./src/lib/celebrations/fonts/*.ttf"],
    "/api/agent/celebrations": ["./src/lib/celebrations/fonts/*.ttf"],
  },

  /** React Native Web config */
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
    };
    config.resolve.extensions = [
      ".web.js",
      ".web.jsx",
      ".web.ts",
      ".web.tsx",
      ...config.resolve.extensions,
    ];
    return config;
  },
};

export default config;
