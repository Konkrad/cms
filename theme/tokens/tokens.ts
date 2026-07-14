/**
 * Theme design tokens as TypeScript constants.
 * Used for email inline styles and any TS context that needs raw token values.
 * Keep in sync with theme.css.
 */

export const colors = {
  primary: "#111827",
  "primary-light": "#1f2937",
  "primary-dark": "#030712",
  accent: "#7c3aed",
  "accent-dark": "#6d28d9",

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

  "focus-ring": "#7c3aed",
} as const;

export const radius = {
  sm: "0.125rem",
  md: "0.125rem",
  lg: "0",
  xl: "0",
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
