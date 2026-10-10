/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: { 900: "#0f172a", 700: "#334155", 500: "#64748b", 400: "#94a3b8" },
        brand: { 50: "#eef2ff", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5" },
      },
      boxShadow: {
        glass: "inset 0 1px 0 rgba(255,255,255,.9), 0 10px 30px -14px rgba(30,41,90,.22)",
        glow: "0 8px 24px -8px rgba(99,102,241,.55)",
      },
      keyframes: {
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(18px,-22px,0) scale(1.08)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        spinsmooth: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        "drift-slow": "drift 26s ease-in-out infinite reverse",
        shimmer: "shimmer 1.6s infinite",
        spinsmooth: "spinsmooth .9s linear infinite",
      },
    },
  },
  plugins: [],
};
