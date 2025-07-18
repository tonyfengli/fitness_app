import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

import baseConfig from "@acme/tailwind-config/web";

export default {
  // We need to append the path to the UI package to the content array so that
  // those classes are included correctly.
  content: [
    ...baseConfig.content, 
    "../../packages/ui/src/*.{ts,tsx}",
    "../../packages/ui-desktop/src/**/*.{ts,tsx}",
    "../../packages/ui-shared/src/**/*.{ts,tsx}"
  ],
  presets: [baseConfig],
  safelist: [
    // Block colors for workout program cards
    'bg-blue-200', 'text-blue-800', 'border-blue-200', 'bg-blue-50', 'hover:bg-blue-50',
    'bg-green-200', 'text-green-800', 'border-green-200', 'bg-green-50', 'hover:bg-green-50',
    'bg-red-200', 'text-red-800', 'border-red-200', 'bg-red-50', 'hover:bg-red-50',
    'bg-yellow-200', 'text-yellow-800', 'border-yellow-200', 'bg-yellow-50', 'hover:bg-yellow-50',
    'bg-purple-200', 'text-purple-800', 'border-purple-200', 'bg-purple-50', 'hover:bg-purple-50',
    'bg-pink-200', 'text-pink-800', 'border-pink-200', 'bg-pink-50', 'hover:bg-pink-50',
    'bg-orange-200', 'text-orange-800', 'border-orange-200', 'bg-orange-50', 'hover:bg-orange-50',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
      },
    },
  },
} satisfies Config;
