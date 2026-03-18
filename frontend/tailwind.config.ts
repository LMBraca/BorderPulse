import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060E1A",
          900: "#0A1628",
          800: "#0F1F38",
          700: "#152A4A",
          600: "#1C365C",
        },
        status: {
          green: "#34D399",
          yellow: "#FBBF24",
          red: "#F87171",
        },
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      borderColor: {
        subtle: "rgba(255, 255, 255, 0.06)",
      },
      backgroundColor: {
        card: "rgba(255, 255, 255, 0.03)",
        "card-hover": "rgba(255, 255, 255, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
