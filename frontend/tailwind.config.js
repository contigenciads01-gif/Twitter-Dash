/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        twitter: {
          blue: "#1D9BF0",
          hover: "#1A8CD8",
          dark: "#0F1419",
          darkBg: "#15202B",
          darkCard: "#1E2732",
          darkBorder: "#2F3336"
        }
      }
    }
  },
  plugins: []
};
