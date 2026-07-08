/**
 * Theme design tokens as TypeScript constants.
 * Used for email inline styles and any TS context that needs raw token values.
 * Keep in sync with theme.css.
 * 
 * This is a generic starting theme with a clean blue/gray color palette.
 * Replace these values with your organization's brand colors.
 */

export const colors = {
  // Primary brand color - replace with your brand's primary color
  primary: "#2563eb",
  "primary-light": "#3b82f6",
  "primary-dark": "#1d4ed8",
  
  // Accent color - complementary to primary, used for highlights
  accent: "#0891b2",
  "accent-dark": "#0e7490",

  // Background colors
  bg: "#f8fafc",
  "bg-card": "#ffffff",
  "bg-muted": "#f1f5f9",

  // Text colors
  text: "#1e293b",
  "text-secondary": "#64748b",
  "text-muted": "#94a3b8",
  "text-heading": "#0f172a",

  // Border colors
  border: "#e2e8f0",
  "border-strong": "#cbd5e1",

  // Semantic colors
  error: "#ef4444",
  "error-bg": "#fef2f2",
  "error-border": "#fecaca",
  success: "#22c55e",
  "success-bg": "#f0fdf4",
  "success-border": "#86efac",
  info: "#3b82f6",
  "info-bg": "#eff6ff",
  "info-border": "#bfdbfe",
  danger: "#ef4444",
  "danger-dark": "#dc2626",

  // Focus ring color (matches primary by default)
  "focus-ring": "#2563eb",
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
