import type { Config } from "tailwindcss";

import baseConfig from "@acme/tailwind/native";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      // TV-specific overrides
      fontSize: {
        // Scale up for 10-foot viewing
        'tv-xs': '1rem',
        'tv-sm': '1.25rem',
        'tv-base': '1.5rem',
        'tv-lg': '2rem',
        'tv-xl': '2.5rem',
        'tv-2xl': '3rem',
        'tv-3xl': '4rem',
        'tv-4xl': '5rem',
        'tv-5xl': '6rem',
      },
      spacing: {
        // TV-safe margins
        'safe-x': '48px',
        'safe-y': '27px',
      }
    }
  }
} satisfies Config;