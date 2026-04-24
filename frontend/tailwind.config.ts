import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060E1A",
          900: "#0A1628",
          800: "#0C1B30",
          700: "#0F2245",
          600: "#122855",
        },
        status: {
          green: "#62c594",
          yellow: "#d4a847",
          red: "#c96450",
          closed: "#4B5563",
        },
        card: "#0C1B30",
        "card-hover": "#0F2245",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      borderColor: {
        subtle: "rgba(255, 255, 255, 0.07)",
        "subtle-faint": "rgba(255, 255, 255, 0.04)",
      },
      backgroundColor: {
        card: "#0C1B30",
        "card-hover": "#0F2245",
      },
      borderRadius: {
        card: "14px",
        "card-lg": "18px",
        pill: "22px",
      },
    },
  },
  plugins: [],
};

export default config;
