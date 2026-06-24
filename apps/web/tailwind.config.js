module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  safelist: [
    "bg-emerald-500",
    "bg-amber-400",
    "bg-rose-500",
    "bg-white",
    "bg-slate-500",
    "bg-slate-200",
    "text-white",
    "text-slate-950",
    "text-slate-700",
    "border",
    "border-slate-200"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#2563eb",
          700: "#1d4ed8"
        }
      }
    }
  },
  plugins: []
};
