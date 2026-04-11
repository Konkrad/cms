/**
 * Design tokens as TypeScript constants.
 * Used by tailwind.config.js and available for email inline styles.
 * Keep in sync with tokens.css.
 */

export const colors = {
  primary: "#034EA2",
  "primary-light": "#0a6dd6",
  "primary-dark": "#031241",
  accent: "#96C247",
  "accent-dark": "#7da636",

  bg: "#f9fafb",
  "bg-card": "#ffffff",
  "bg-muted": "#f3f4f6",

  text: "#1f2937",
  "text-secondary": "#4b5563",
  "text-muted": "#6b7280",
  "text-heading": "#111827",

  border: "#e5e7eb",
  "border-strong": "#d1d5db",

  error: "#b91c1c",
  "error-bg": "#fef2f2",
  "error-border": "#fca5a5",
  success: "#047857",
  "success-bg": "#ecfdf5",
  "success-border": "#6ee7b7",
  info: "#1d4ed8",
  "info-bg": "#eff6ff",
  "info-border": "#bfdbfe",
  danger: "#dc2626",
  "danger-dark": "#b91c1c",

  "focus-ring": "#034EA2",
} as const;

export const radius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
} as const;

export const fonts = {
  sans: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "'Segoe UI'",
    "Roboto",
    "'Helvetica Neue'",
    "Arial",
    "'Noto Sans'",
    "sans-serif",
    "'Apple Color Emoji'",
    "'Segoe UI Emoji'",
    "'Segoe UI Symbol'",
    "'Noto Color Emoji'",
  ],
} as const;
