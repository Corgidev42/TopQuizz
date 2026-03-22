/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F97316",
          "orange-light": "#FB923C",
          "orange-dark": "#EA580C",
        },
        surface: {
          DEFAULT: "#1A1A1A",
          light: "#2A2A2A",
          dark: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "bounce-in": "bounceIn 0.5s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "float": "floatSm 6s ease-in-out infinite",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(249, 115, 22, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(249, 115, 22, 0.35)" },
        },
        floatSm: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(249, 115, 22, 0.2)",
        "glow-md": "0 0 30px rgba(249, 115, 22, 0.25)",
        "glow-lg": "0 0 60px rgba(249, 115, 22, 0.3)",
        "glow-blue": "0 0 30px rgba(59, 130, 246, 0.25)",
        "glow-purple": "0 0 30px rgba(139, 92, 246, 0.25)",
      },
    },
  },
  plugins: [],
};
