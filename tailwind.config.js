import { colors } from "./src/design/tokens.ts";

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: colors.primary,
					light: colors["primary-light"],
					dark: colors["primary-dark"],
				},
				accent: {
					DEFAULT: colors.accent,
					dark: colors["accent-dark"],
				},
				bg: {
					DEFAULT: colors.bg,
					card: colors["bg-card"],
					muted: colors["bg-muted"],
				},
				text: {
					DEFAULT: colors.text,
					secondary: colors["text-secondary"],
					muted: colors["text-muted"],
					heading: colors["text-heading"],
				},
				border: {
					DEFAULT: colors.border,
					strong: colors["border-strong"],
				},
				error: {
					DEFAULT: colors.error,
					bg: colors["error-bg"],
					border: colors["error-border"],
				},
				success: {
					DEFAULT: colors.success,
					bg: colors["success-bg"],
					border: colors["success-border"],
				},
				info: {
					DEFAULT: colors.info,
					bg: colors["info-bg"],
					border: colors["info-border"],
				},
				danger: {
					DEFAULT: colors.danger,
					dark: colors["danger-dark"],
				},
				"focus-ring": colors["focus-ring"],
			},
		},
	},
	plugins: [],
};
