import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B1020",
        surface: "#121A2F",
        primary: "#00C2FF",
        secondary: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        text: "#E5E7EB",
        muted: "#94A3B8"
      },
      borderRadius: {
        brand: "14px"
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        soft: "0 12px 30px rgba(0, 194, 255, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
