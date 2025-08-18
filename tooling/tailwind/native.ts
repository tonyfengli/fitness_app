import type { Config } from "tailwindcss";

import base from "./base";

// eslint-disable-next-line @typescript-eslint/no-require-imports
import nativewindPreset = require("nativewind/preset");

export default {
  content: base.content,
  presets: [base, nativewindPreset],
  theme: {},
} satisfies Config;
