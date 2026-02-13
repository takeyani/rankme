import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1C2127",
        secondary: "#F8FAFC",
        accent: "#0891B2",
        "accent-secondary": "#059669",
        "accent-tertiary": "#D97706",
        muted: "#94A3B8",
        subtle: "#E2E8F0",
        danger: "#DC2626",
        surface: "#FFFFFF",
        background: {
          light: "#F8FAFC",
          dark: "#0F172A",
        },
        "text-primary": "#1E293B",
        "text-secondary": "#64748B",
        border: {
          light: "#E2E8F0",
          dark: "#334155",
        },
        score: {
          "rank-1": "#DC2626",
          "rank-2": "#EA580C",
          "rank-3": "#D97706",
          "rank-4": "#CA8A04",
          "rank-5": "#A3A30A",
          "rank-6": "#65A30D",
          "rank-7": "#16A34A",
          "rank-8": "#059669",
          "rank-9": "#0891B2",
          "rank-10": "#0284C7",
        },
        dark: {
          bg: "#0F172A",
          surface: "#1E293B",
          "text-primary": "#F1F5F9",
          "text-secondary": "#94A3B8",
          border: "#334155",
          accent: "#22D3EE",
        },
      },
      fontFamily: {
        heading: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        body: ["var(--font-noto-sans-jp)", "system-ui", "sans-serif"],
        score: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: "2.5rem",
        h2: "2rem",
        h3: "1.5rem",
        h4: "1.25rem",
        "body-lg": "1.125rem",
        "body-sm": "0.875rem",
        caption: "0.75rem",
        "score-display": "5rem",
        advice: "0.9375rem",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
        xl: "0 20px 25px rgba(0, 0, 0, 0.1)",
      },
      transitionDuration: {
        fast: "100ms",
        normal: "150ms",
        slow: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
