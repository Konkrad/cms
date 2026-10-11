import type { QRL } from "@qwik.dev/core";
import { component$ } from "@qwik.dev/core";
import { qwikify$ } from "@qwik.dev/react";
import type { LinkTargetOption, MenuItem } from "./MenuTableReact";
import { MenuTable as MenuTableReact } from "./MenuTableReact";

const QwikMenuTable = qwikify$(MenuTableReact, {
	eagerness: "load",
	clientOnly: true,
});

interface ActionResult {
	success: boolean;
	error?: string;
}

interface MenuTableProps {
	mainItems: MenuItem[];
	footerItems: MenuItem[];
	staticUrls: string[];
	linkTargets?: LinkTargetOption[];
	onMove$: QRL<
		(params: {
			movedItemId: string;
			targetItemId?: string;
			mode: "before" | "as-child" | "to-hidden" | "to-visible-root";
			menuName: "main" | "footer";
		}) => Promise<ActionResult>
	>;
	onUpdate$: QRL<
		(params: {
			menuName: string;
			menuItemId: string;
			title: string;
			url: string;
			parentId?: string;
			target: string;
			icon?: string;
		}) => Promise<ActionResult>
	>;
	onAdd$: QRL<
		(params: {
			menuName: "main" | "footer";
			title: string;
			url: string;
			icon?: string;
			hidden?: boolean; // legacy; prefer status
			status?: "visible" | "hidden";
		}) => Promise<ActionResult>
	>;
	onDelete$: QRL<(params: { menuItemId: string }) => Promise<ActionResult>>;
}

export const MenuTable = component$<MenuTableProps>((props) => {
	return (
		<QwikMenuTable
			mainItems={props.mainItems}
			footerItems={props.footerItems}
			staticUrls={props.staticUrls}
			linkTargets={props.linkTargets}
			onMove$={props.onMove$}
			onUpdate$={props.onUpdate$}
			onAdd$={props.onAdd$}
			onDelete$={props.onDelete$}
		/>
	);
});
