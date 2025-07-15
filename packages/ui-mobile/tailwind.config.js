/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Match test page colors exactly
        primary: {
          600: "#4F46E5",
          100: "#E0E7FF",
        },
      },
    },
  },
  plugins: [],
};