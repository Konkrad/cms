/**
 * Slots (spec 4.1, guide 5.9): named places on screens a module does not own where active modules
 * add a component (manifest `slots: { [name]: Component }`). Core renders each slot's
 * contributions of the ACTIVE modules, in module order, with the props below; a slot component
 * loads its own data through a `server$()` composable that authorizes first and returns only what
 * the viewer may see. The theme only marks where a slot goes (a named Qwik `<Slot>`).
 */
import type { Component } from "@qwik.dev/core";

export interface SlotProps {
	/** Sections of the viewer's OWN profile (`/profile`): my events, my election history. */
	"profile.sections": Record<string, never>;
	/** Settings on the viewer's own profile: optional requirements they can change later. */
	"profile.settings": Record<string, never>;
	/** Sections of another user's public profile (`/users/<id>`); public data of `userId` only. */
	"userPage.sections": { userId: string };
	/** Sections of a scope's public home page (`/germany/berlin`), as the viewer may see them. */
	"scopePage.sections": { scopeId: string };
	/** Widgets on a scope's admin dashboard (`/admin/<scope>`); `adminBase` = "/admin/germany.berlin". */
	"admin.dashboard.widgets": { scopeId: string; adminBase: string };
	/**
	 * Sections of a scope's statistics page (`/admin/<scope>/statistics`), small groups hidden
	 * (`suppressSmall` from `~/core`). `includeBelow`: count the scope's own activity only
	 * (false) or with every scope below it (true), as the page's switch says. `compare`: the
	 * viewer asked to compare the scopes below: the lowest ones ("leaves", e.g. every chapter)
	 * or those directly below ("children"); null = no comparison.
	 */
	"admin.statistics.sections": {
		scopeId: string;
		adminBase: string;
		includeBelow: boolean;
		compare: StatisticsCompare | null;
	};
}

export type SlotName = keyof SlotProps;

/** What a module contributes: at most one component per slot. */
export type SlotComponents = {
	[Name in SlotName]?: Component<SlotProps[Name]>;
};

/** Which scopes below a statistics page compares: the lowest ones, or those directly below. */
export type StatisticsCompare = "leaves" | "children";

export const SLOT_NAMES = [
	"profile.sections",
	"profile.settings",
	"userPage.sections",
	"scopePage.sections",
	"admin.dashboard.widgets",
	"admin.statistics.sections",
] as const satisfies readonly SlotName[];
