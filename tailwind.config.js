/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "sans-serif"],
        game: ["Lilita One", "Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        bg: "#FAF9F6",
        surface: "#FFFFFF",
        border: "#E5E2DB",
        ink: "#1C1B19",
        muted: "#6F6B62",
        teal: { DEFAULT: "#0D7D72", dark: "#095D55" },
        amber: { DEFAULT: "#C77D22" },
        danger: { DEFAULT: "#B23A2E" },
        night: { DEFAULT: "#153840", deep: "#0d2226", light: "#24505a" },
        gold: { DEFAULT: "#e6b94f", deep: "#9a6a1c", soft: "#f6e4a8" },
        parch: { DEFAULT: "#f7edd3", edge: "#e6d6ab", ink: "#3a2a12" },
        gem: { DEFAULT: "#39c5d3" },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
      },
    },
  },
  plugins: [],
};
