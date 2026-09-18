/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "sans-serif"],
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
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
      },
    },
  },
  plugins: [],
};
