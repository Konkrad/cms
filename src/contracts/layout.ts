/**
 * Core → theme data contracts for the root layout chrome (Navigation, SiteFooter).
 *
 * The layout (`src/routes/layout.tsx`) owns the loaders/action; this barrel
 * re-exports the types theme chrome needs so it never calls a core loader
 * directly. `import type` only — these carry no runtime code.
 */
import type {
	useFooterMenuItems,
	useLogoutAction,
	useMenuItems,
} from "~/routes/layout";

export type MainMenuItems = ReturnType<typeof useMenuItems>["value"];
export type FooterMenuItems = ReturnType<typeof useFooterMenuItems>["value"];
export type LogoutAction = ReturnType<typeof useLogoutAction>;

/** The logged-in user as the nav needs it; the layout's `useUserSession` returns exactly this. */
export type NavUser = {
	id: string;
	displayName: string;
	isAdmin: boolean;
	profilePictureSmallUrl: string | null;
} | null;
