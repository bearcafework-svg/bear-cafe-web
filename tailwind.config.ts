import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Athiti", "sans-serif"],
        display: ["Athiti", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Bear Café Macaroon custom colors
        bear: {
          brown: "hsl(var(--bear-brown))",
          light: "hsl(var(--bear-light))",
        },
        cream: "hsl(var(--cream))",
        latte: "hsl(var(--latte))",
        honey: "hsl(var(--honey))",
        mocha: "hsl(var(--mocha))",
        coffee: "hsl(var(--coffee))",
        matcha: "hsl(var(--matcha))",
        berry: "hsl(var(--berry))",
        peach: "hsl(var(--peach))",
        blush: "hsl(var(--blush))",
        mint: "hsl(var(--mint))",
        lavender: "hsl(var(--lavender))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        bear: "0 4px 14px 0 hsl(var(--primary) / 0.15)",
        "bear-lg": "0 10px 30px -5px hsl(var(--primary) / 0.2)",
        honey: "0 4px 14px 0 hsl(var(--honey) / 0.3)",
        cream: "0 4px 20px 0 hsl(var(--border) / 0.4)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(10px)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        wiggle: "wiggle 0.5s ease-in-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    plugin(function ({ addUtilities }) {
      const bearTextStyles = {
        // Header styles
        ".bear-h1": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "32px",
          letterSpacing: "0",
        },
        ".bear-h1-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "32px",
          letterSpacing: "0",
        },
        ".bear-h1-bold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "700",
          fontSize: "32px",
          letterSpacing: "0",
        },
        ".bear-h2": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "24px",
          letterSpacing: "0",
        },
        ".bear-h2-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "24px",
          letterSpacing: "0",
        },
        ".bear-h2-bold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "700",
          fontSize: "24px",
          letterSpacing: "0",
        },
        ".bear-h3": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "20px",
          letterSpacing: "0",
        },
        ".bear-h3-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "20px",
          letterSpacing: "0",
        },
        ".bear-h3-bold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "700",
          fontSize: "20px",
          letterSpacing: "0",
        },
        // Body Large styles
        ".bear-body-large-regular": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "18px",
          letterSpacing: "0",
        },
        ".bear-body-large-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "18px",
          letterSpacing: "0",
        },
        ".bear-body-large-bold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "700",
          fontSize: "18px",
          letterSpacing: "0",
        },
        // Body Regular styles
        ".bear-body-regular": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "16px",
          letterSpacing: "0",
        },
        ".bear-body-regular-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "16px",
          letterSpacing: "0",
        },
        ".bear-body-regular-semibold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "600",
          fontSize: "16px",
          letterSpacing: "0",
        },
        ".bear-body-regular-bold": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "700",
          fontSize: "16px",
          letterSpacing: "0",
        },
        // Body Small styles (14px)
        ".bear-body-small-regular": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "14px",
          letterSpacing: "0",
        },
        ".bear-body-small-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "14px",
          letterSpacing: "0",
        },
        // Body XSmall styles (12px)
        ".bear-body-xsmall-regular": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "400",
          fontSize: "12px",
          letterSpacing: "0",
        },
        ".bear-body-xsmall-medium": {
          fontFamily: "Athiti, sans-serif",
          fontWeight: "500",
          fontSize: "12px",
          letterSpacing: "0",
        },
      };
      addUtilities(bearTextStyles);
    }),
  ],
} satisfies Config;
