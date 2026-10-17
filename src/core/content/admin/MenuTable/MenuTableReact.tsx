/** @jsxImportSource react */

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { sanitizeSvg } from "~/core/content/svg-sanitize";
import { t } from "~/core/i18n";

// References (`ref:…`), their human form (`root/germany:events`) and external links are
// kept as typed; the server turns them into what is stored (`toStoredLink`).
const normalizeUrl = (url: string): string => {
	const trimmed = url.trim();
	if (!trimmed) return "/";
	if (/^(https?:\/\/|mailto:|tel:|ref:|root(\/|:|$))/i.test(trimmed))
		return trimmed;
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

/** Datalist the URL inputs share: scopes, listings and pages as references (link picker). */
const LINK_TARGETS_ID = "menu-link-targets";

const getDepth = (items: MenuItem[], id: string): number => {
	const byId = new Map(items.map((i) => [i.id, i]));
	const calc = (currentId: string): number => {
		const item = byId.get(currentId);
		if (!item?.parentId) return 0;
		return calc(item.parentId) + 1;
	};
	return calc(id);
};

// DFS walk: produces items in visual tree order (parent immediately followed by its children)
const treeOrder = (items: MenuItem[], parentId: string | null): MenuItem[] =>
	items
		.filter((i) => i.parentId === parentId)
		.sort((a, b) => a.position - b.position)
		.flatMap((item) => [item, ...treeOrder(items, item.id)]);

export interface MenuItem {
	id: string;
	title: string;
	url: string;
	pageId: string | null;
	parentId: string | null;
	position: number;
	status: "visible" | "hidden";
	menuName: string;
	icon: string | null;
	target: string;
	/** Where the item currently links to (its reference resolved), shown instead of `url`. */
	urlLabel?: string;
}

/** One link picker entry: the value to store and what it points to. */
export interface LinkTargetOption {
	value: string;
	label: string;
}

interface ActionResult {
	success: boolean;
	error?: string;
}

export interface MenuTableProps {
	mainItems: MenuItem[];
	footerItems: MenuItem[];
	staticUrls: string[];
	/** Internal link targets offered in the URL inputs (scopes, listings, pages). */
	linkTargets?: LinkTargetOption[];
	onMove: (params: {
		movedItemId: string;
		targetItemId?: string;
		mode: "before" | "as-child" | "to-hidden" | "to-visible-root";
		menuName: "main" | "footer";
	}) => Promise<ActionResult>;
	onUpdate: (params: {
		menuName: string;
		menuItemId: string;
		title: string;
		url: string;
		parentId?: string;
		target: string;
		icon?: string;
	}) => Promise<ActionResult>;
	onAdd: (params: {
		menuName: "main" | "footer";
		title: string;
		url: string;
		icon?: string;
		status?: "visible" | "hidden";
	}) => Promise<ActionResult>;
	onDelete: (params: { menuItemId: string }) => Promise<ActionResult>;
}

interface DropInfo {
	targetId: string;
	mode: "before" | "child";
}

// ── Sub-components (hooks must live here, not in .map callbacks) ──

interface SortableRowProps {
	id: string;
	dropInfo: DropInfo | null;
	allowChild: boolean;
	baseStyle?: React.CSSProperties;
	className?: string;
	children: React.ReactNode;
}

function SortableRow({
	id,
	dropInfo,
	allowChild,
	baseStyle,
	className,
	children,
}: SortableRowProps) {
	const { ref: dragRef, handleRef, isDragging } = useDraggable({ id });
	// Use a distinct droppable id so dnd-kit never confuses the draggable source
	// with a droppable target during collision detection.
	const { ref: dropRef } = useDroppable({ id: `drop-${id}` });

	// Merge drag + drop refs onto the same <tr>
	const ref = (el: HTMLTableRowElement | null) => {
		dragRef(el);
		dropRef(el);
	};

	const style: React.CSSProperties = { ...baseStyle };
	if (isDragging) style.opacity = 0.4;
	const isHovered = dropInfo?.targetId === id;
	if (isHovered) {
		if (dropInfo!.mode === "before")
			style.boxShadow = "inset 0 2px 0 var(--color-info)";
		else if (dropInfo!.mode === "child") style.background = "#f5f3ff";
	}

	return (
		<tr ref={ref} id={`row-${id}`} style={style} className={className}>
			<td
				ref={handleRef as React.RefCallback<HTMLTableCellElement>}
				className="px-2 py-3 text-gray-300 cursor-grab select-none text-center"
			>
				⠿
			</td>
			{children}
		</tr>
	);
}

function EndOfVisibleRow({ isActive }: { isActive: boolean }) {
	const { ref } = useDroppable({ id: "visible-end" });
	return (
		<tr ref={ref} style={{ height: 6 }}>
			<td
				colSpan={4}
				style={{
					padding: 0,
					borderTop: isActive
						? "2px solid var(--color-info)"
						: "2px solid transparent",
				}}
			/>
		</tr>
	);
}

function SeparatorRow() {
	const { ref, isDropTarget } = useDroppable({ id: "separator" });
	return (
		<tr
			ref={ref}
			style={{ background: isDropTarget ? "var(--color-error-bg)" : undefined }}
		>
			<td colSpan={4} className="px-4 py-2">
				<div className="flex items-center gap-3">
					<div className="flex-1 border-t-2 border-dashed border-gray-300" />
					<span className="text-xs text-gray-400 whitespace-nowrap">
						{t("admin.menuTableReact.hiddenBelow")}
					</span>
					<div className="flex-1 border-t-2 border-dashed border-gray-300" />
				</div>
			</td>
		</tr>
	);
}

// ── Main component ──

export const MenuTable = (props: MenuTableProps) => {
	const {
		mainItems,
		footerItems,
		staticUrls,
		linkTargets = [],
		onMove,
		onUpdate,
		onAdd,
		onDelete,
	} = props;

	const statusBadge = (item: MenuItem) => {
		if (!item.pageId) return null;
		return item.status === "visible" ? (
			<span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-green-700 bg-green-100 rounded px-1 py-0.5">
				{t("admin.menuTableReact.visible")}
			</span>
		) : (
			<span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-yellow-700 bg-yellow-100 rounded px-1 py-0.5">
				{t("admin.menuTableReact.hidden")}
			</span>
		);
	};

	const [mainEditingId, setMainEditingId] = useState<string | null>(null);
	const [footerEditingId, setFooterEditingId] = useState<string | null>(null);
	const [moveError, setMoveError] = useState<string | null>(null);
	const [updateError, setUpdateError] = useState<string | null>(null);
	const [addError, setAddError] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [dropInfo, setDropInfoState] = useState<DropInfo | null>(null);
	const dropInfoRef = useRef<DropInfo | null>(null);
	const setDropInfo = useCallback((info: DropInfo | null) => {
		dropInfoRef.current = info;
		setDropInfoState(info);
	}, []);

	const staticUrlSet = new Set(staticUrls);
	// Use tree-order (DFS) so children always render immediately after their parent,
	// regardless of the raw position values (which are relative within each sibling group).
	const visibleItems = treeOrder(
		mainItems.filter((i) => i.status === "visible"),
		null,
	);
	const hiddenItems = [...mainItems]
		.filter((i) => i.status === "hidden")
		.sort((a, b) => a.position - b.position);
	const sortedFooter = treeOrder(footerItems, null);

	// Only root-level (depth-0) items may accept children — enforces 2-level max
	const rootVisibleIdSet = new Set(
		visibleItems.filter((i) => !i.parentId).map((i) => i.id),
	);
	const footerIdSet = new Set(sortedFooter.map((i) => i.id));

	// Track which half the pointer is over to determine before/child mode
	const handleDragMove = useCallback(
		(event: any) => {
			const rawTargetId = event.operation?.target?.id as string | undefined;
			if (!rawTargetId) {
				setDropInfo(null);
				return;
			}
			// SortableRow droppables are registered as "drop-{itemId}" — strip the prefix
			const targetId = rawTargetId.startsWith("drop-")
				? rawTargetId.slice(5)
				: rawTargetId;
			if (targetId === "separator") {
				if (dropInfoRef.current?.targetId !== "separator") {
					setDropInfo({ targetId: "separator", mode: "before" });
				}
				return;
			}
			if (targetId === "visible-end") {
				if (dropInfoRef.current?.targetId !== "visible-end") {
					setDropInfo({ targetId: "visible-end", mode: "before" });
				}
				return;
			}
			const targetEl = event.operation?.target?.element as
				| HTMLElement
				| undefined;
			if (!targetEl) return;
			const rect = targetEl.getBoundingClientRect();
			const pointerY = event.operation?.position?.current?.y ?? 0;
			const isTopHalf = pointerY < rect.top + rect.height / 2;
			// Only depth-0 items can accept children (2-level max)
			const allowChild = rootVisibleIdSet.has(targetId);
			const mode: "before" | "child" =
				isTopHalf || !allowChild ? "before" : "child";
			if (
				dropInfoRef.current?.targetId !== targetId ||
				dropInfoRef.current?.mode !== mode
			) {
				setDropInfo({ targetId, mode });
			}
		},
		[rootVisibleIdSet],
	);

	const handleDragEnd = useCallback(
		async (event: any) => {
			// Use dropInfoRef exclusively — it is always up-to-date from handleDragMove.
			// Relying on event.operation?.target?.id is unreliable when the same element is
			// registered as both draggable and droppable (dnd-kit collision can resolve to the
			// wrong droppable), so we bypass it entirely for item targets.
			const lastDropInfo = dropInfoRef.current;
			setDropInfo(null);
			if (event.canceled || !lastDropInfo) return;

			const sourceId = String(event.operation?.source?.id ?? "");
			if (!sourceId) return;

			const { targetId, mode } = lastDropInfo;

			if (targetId === "separator") {
				setMoveError(null);
				const result = await onMove({
					movedItemId: sourceId,
					mode: "to-hidden",
					menuName: "main",
				});
				if (!result.success)
					setMoveError(result.error ?? t("admin.menuTableReact.moveFailed"));
				return;
			}

			if (targetId === "visible-end") {
				setMoveError(null);
				const result = await onMove({
					movedItemId: sourceId,
					mode: "to-visible-root",
					menuName: "main",
				});
				if (!result.success)
					setMoveError(result.error ?? t("admin.menuTableReact.moveFailed"));
				return;
			}

			if (targetId === sourceId) return;

			const moveMode: "before" | "as-child" =
				mode === "child" ? "as-child" : "before";
			const menuName = footerIdSet.has(targetId) ? "footer" : "main";
			setMoveError(null);
			const result = await onMove({
				movedItemId: sourceId,
				targetItemId: targetId,
				mode: moveMode,
				menuName,
			});
			if (!result.success)
				setMoveError(result.error ?? t("admin.menuTableReact.moveFailed"));
		},
		[onMove, footerIdSet, setDropInfo],
	);

	// ── Form submit handlers ──

	const handleUpdateSubmit = async (
		e: React.FormEvent<HTMLFormElement>,
		item: MenuItem,
	) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		setUpdateError(null);
		const result = await onUpdate({
			menuName: item.menuName,
			menuItemId: item.id,
			title: fd.get("title") as string,
			url: fd.get("url") as string,
			parentId: item.parentId ?? undefined,
			target: item.target,
			icon:
				item.menuName === "footer"
					? (fd.get("icon") as string) || undefined
					: undefined,
		});
		if (result.success) {
			if (item.menuName === "main") setMainEditingId(null);
			else setFooterEditingId(null);
		} else {
			setUpdateError(result.error ?? t("admin.menuTableReact.updateFailed"));
		}
	};

	const handleAddFooterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		setAddError(null);
		const result = await onAdd({
			menuName: "footer",
			title: fd.get("title") as string,
			url: fd.get("url") as string,
			icon: (fd.get("icon") as string) || undefined,
		});
		if (result.success) form.reset();
		else setAddError(result.error ?? t("admin.menuTableReact.addFailed"));
	};

	const handleSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const text = await file.text();
		const form = e.target.closest("form");
		const iconField = form?.querySelector(
			'input[name="icon"]',
		) as HTMLInputElement | null;
		if (iconField) iconField.value = text;
	};

	const handleDelete = async (item: MenuItem) => {
		if (
			!confirm(t("admin.menuTableReact.confirmRemove", { title: item.title }))
		)
			return;
		setDeleteError(null);
		const result = await onDelete({ menuItemId: item.id });
		if (!result.success)
			setDeleteError(result.error ?? t("admin.menuTableReact.deleteFailed"));
	};

	return (
		<DragDropProvider onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
			<datalist id={LINK_TARGETS_ID}>
				{linkTargets.map((target) => (
					<option key={target.value} value={target.value}>
						{target.label}
					</option>
				))}
			</datalist>
			{moveError && (
				<div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{moveError}
				</div>
			)}
			{updateError && (
				<div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{updateError}
				</div>
			)}
			{addError && (
				<div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{addError}
				</div>
			)}
			{deleteError && (
				<div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{deleteError}
				</div>
			)}

			{/* ── Main Menu ── */}
			<div className="mt-6">
				<h3 className="text-xl font-bold mb-1">
					{t("admin.menuTableReact.mainMenu")}
				</h3>
				<p className="text-sm text-gray-500 mb-3">
					{t("admin.menuTableReact.dragToReorderDrop")}{" "}
					<em>{t("admin.menuTableReact.onto")}</em>{" "}
					{t("admin.menuTableReact.anItemToNestIt")}
				</p>

				<div className="bg-white shadow-sm rounded-lg overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-2 py-3 w-8" />
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.label")}
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.url")}
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.actions")}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 bg-white">
							{visibleItems.map((item) => (
								<SortableRow
									key={item.id}
									id={item.id}
									dropInfo={dropInfo}
									allowChild
								>
									<td
										className="px-4 py-3 text-sm font-medium text-gray-900"
										style={{
											paddingLeft: 16 + getDepth(mainItems, item.id) * 24,
										}}
									>
										{item.title}
										{staticUrlSet.has(normalizeUrl(item.url)) && (
											<span className="ml-2 text-xs text-gray-400">
												{t("admin.menuTableReact.static")}
											</span>
										)}
										{statusBadge(item)}
									</td>
									<td className="px-4 py-3 text-sm text-gray-600">
										{item.urlLabel ?? normalizeUrl(item.url)}
									</td>
									<td className="px-4 py-3 text-sm">
										{staticUrlSet.has(normalizeUrl(item.url)) ? (
											<button
												type="button"
												className="text-blue-600 hover:text-blue-900"
												onClick={() =>
													setMainEditingId((prev) =>
														prev === item.id ? null : item.id,
													)
												}
											>
												{t("admin.menuTableReact.rename")}
											</button>
										) : (
											<div className="flex items-center gap-3">
												{item.pageId ? (
													<>
														<a
															href={`/admin/root/pages/${item.pageId}/edit`}
															className="text-blue-600 hover:text-blue-900"
														>
															{t("admin.menuTableReact.edit")}
														</a>
														<a
															href={`/admin/root/pages/${item.pageId}/builder`}
															className="text-blue-600 hover:text-blue-900"
														>
															{t("admin.menuTableReact.builder")}
														</a>
													</>
												) : (
													<button
														type="button"
														className="text-blue-600 hover:text-blue-900"
														onClick={() =>
															setMainEditingId((prev) =>
																prev === item.id ? null : item.id,
															)
														}
													>
														{t("admin.menuTableReact.edit")}
													</button>
												)}
												<button
													type="button"
													className="text-red-600 hover:text-red-900"
													onClick={() => handleDelete(item)}
												>
													{t("admin.menuTableReact.delete")}
												</button>
											</div>
										)}
									</td>
								</SortableRow>
							))}

							<EndOfVisibleRow
								isActive={dropInfo?.targetId === "visible-end"}
							/>
							<SeparatorRow />

							{hiddenItems.map((item) => (
								<SortableRow
									key={item.id}
									id={item.id}
									dropInfo={dropInfo}
									allowChild={false}
									baseStyle={{ background: "var(--color-bg)" }}
									className="text-gray-400"
								>
									<td className="px-4 py-3 text-sm">
										{item.title}
										{staticUrlSet.has(normalizeUrl(item.url)) && (
											<span className="ml-2 text-xs">
												{t("admin.menuTableReact.static")}
											</span>
										)}
										{statusBadge(item)}
									</td>
									<td className="px-4 py-3 text-sm">
										{item.urlLabel ?? normalizeUrl(item.url)}
									</td>
									<td className="px-4 py-3 text-sm">
										{staticUrlSet.has(normalizeUrl(item.url)) ? (
											<button
												type="button"
												className="text-blue-500 hover:text-blue-700"
												onClick={() =>
													setMainEditingId((prev) =>
														prev === item.id ? null : item.id,
													)
												}
											>
												{t("admin.menuTableReact.rename")}
											</button>
										) : (
											<div className="flex items-center gap-3">
												{item.pageId ? (
													<>
														<a
															href={`/admin/root/pages/${item.pageId}/edit`}
															className="text-blue-500 hover:text-blue-700"
														>
															{t("admin.menuTableReact.edit")}
														</a>
														<a
															href={`/admin/root/pages/${item.pageId}/builder`}
															className="text-blue-500 hover:text-blue-700"
														>
															{t("admin.menuTableReact.builder")}
														</a>
													</>
												) : (
													<button
														type="button"
														className="text-blue-500 hover:text-blue-700"
														onClick={() =>
															setMainEditingId((prev) =>
																prev === item.id ? null : item.id,
															)
														}
													>
														{t("admin.menuTableReact.edit")}
													</button>
												)}
												<button
													type="button"
													className="text-red-500 hover:text-red-700"
													onClick={() => handleDelete(item)}
												>
													{t("admin.menuTableReact.delete")}
												</button>
											</div>
										)}
									</td>
								</SortableRow>
							))}
						</tbody>
					</table>
				</div>

				{mainItems
					.filter((item) => mainEditingId === item.id)
					.map((item) => (
						<form
							key={item.id}
							className="mt-3 flex flex-wrap gap-2 border rounded-sm p-3 bg-gray-50"
							onSubmit={(e) => handleUpdateSubmit(e, item)}
						>
							<input
								type="text"
								name="title"
								defaultValue={item.title}
								placeholder={t("admin.menuTableReact.title")}
								className="border rounded-sm px-2 py-1 text-sm"
								required
							/>
							{staticUrlSet.has(normalizeUrl(item.url)) ? (
								<input
									type="hidden"
									name="url"
									value={normalizeUrl(item.url)}
								/>
							) : (
								<input
									type="text"
									name="url"
									list={LINK_TARGETS_ID}
									defaultValue={normalizeUrl(item.url)}
									placeholder={t("admin.menuTableReact.url")}
									className="border rounded-sm px-2 py-1 text-sm"
									required
								/>
							)}
							<button
								type="submit"
								className="px-3 py-1 bg-blue-600 text-white rounded-sm text-sm hover:bg-blue-700"
							>
								{t("admin.menuTableReact.save")}
							</button>
						</form>
					))}
			</div>

			{/* ── Footer Links ── */}
			<div className="mt-10">
				<h3 className="text-xl font-bold mb-3">
					{t("admin.menuTableReact.footerLinks")}
				</h3>

				<form
					className="flex flex-wrap gap-2 mb-4 border rounded-sm p-3 bg-gray-50"
					onSubmit={handleAddFooterSubmit}
				>
					<input
						type="text"
						name="title"
						placeholder={t("admin.menuTableReact.labelAlsoUsedAsTooltip")}
						className="border rounded-sm px-2 py-1 text-sm flex-1 min-w-[160px]"
						required
					/>
					<input
						type="text"
						name="url"
						list={LINK_TARGETS_ID}
						placeholder={t("admin.menuTableReact.imprintRootGermanyEventsOr")}
						className="border rounded-sm px-2 py-1 text-sm flex-1 min-w-[160px]"
						required
					/>
					<label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer border rounded-sm px-2 py-1">
						{t("admin.menuTableReact.svgIconOptional")}
						<input
							type="file"
							accept=".svg,image/svg+xml"
							className="text-xs"
							onChange={handleSvgUpload}
						/>
						<input type="hidden" name="icon" />
					</label>
					<button
						type="submit"
						className="px-3 py-1 bg-blue-600 text-white rounded-sm text-sm hover:bg-blue-700"
					>
						{t("admin.menuTableReact.add")}
					</button>
				</form>

				<div className="bg-white shadow-sm rounded-lg overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-2 py-3 w-8" />
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.label")}
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.url")}
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									{t("admin.menuTableReact.actions")}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 bg-white">
							{sortedFooter.map((item) => (
								<SortableRow
									key={item.id}
									id={item.id}
									dropInfo={dropInfo}
									allowChild={false}
								>
									<td className="px-4 py-3 text-sm font-medium text-gray-900">
										{item.title}
									</td>
									<td className="px-4 py-3 text-sm text-gray-600">
										{item.urlLabel ?? normalizeUrl(item.url)}
									</td>
									<td className="px-4 py-3 text-sm">
										{(() => {
											const svg = item.icon ? sanitizeSvg(item.icon) : "";
											return svg ? (
												<span
													className="inline-block w-5 h-5 text-gray-600"
													title={item.title}
													dangerouslySetInnerHTML={{ __html: svg }}
												/>
											) : (
												<span className="text-xs text-gray-300">–</span>
											);
										})()}
									</td>
									<td className="px-4 py-3 text-sm">
										<div className="flex items-center gap-3">
											<button
												type="button"
												className="text-blue-600 hover:text-blue-900"
												onClick={() =>
													setFooterEditingId((prev) =>
														prev === item.id ? null : item.id,
													)
												}
											>
												{t("admin.menuTableReact.edit")}
											</button>
											<button
												type="button"
												className="text-red-600 hover:text-red-900"
												onClick={() => handleDelete(item)}
											>
												{t("admin.menuTableReact.delete")}
											</button>
										</div>
									</td>
								</SortableRow>
							))}
						</tbody>
					</table>
				</div>

				{sortedFooter
					.filter((item) => footerEditingId === item.id)
					.map((item) => (
						<form
							key={item.id}
							className="mt-3 flex flex-wrap gap-2 border rounded-sm p-3 bg-gray-50"
							onSubmit={(e) => handleUpdateSubmit(e, item)}
						>
							<input
								type="text"
								name="title"
								defaultValue={item.title}
								placeholder={t("admin.menuTableReact.labelAlsoUsedAsTooltip")}
								className="border rounded-sm px-2 py-1 text-sm flex-1 min-w-[160px]"
								required
							/>
							<input
								type="text"
								name="url"
								list={LINK_TARGETS_ID}
								defaultValue={normalizeUrl(item.url)}
								placeholder={t("admin.menuTableReact.url")}
								className="border rounded-sm px-2 py-1 text-sm flex-1 min-w-[160px]"
								required
							/>
							<div className="w-full flex items-center gap-2">
								<label
									htmlFor={`menu-icon-file-${item.id}`}
									className="text-xs text-gray-500"
								>
									{t("admin.menuTableReact.svgIconReplacesLabelVisually")}
								</label>
								<input
									id={`menu-icon-file-${item.id}`}
									type="file"
									accept=".svg,image/svg+xml"
									className="text-xs"
									onChange={handleSvgUpload}
								/>
								{item.icon?.startsWith("<svg") && (
									<span className="text-xs text-gray-400">
										{t("admin.menuTableReact.currentIconSetUploadTo")}
									</span>
								)}
								<input
									type="hidden"
									name="icon"
									defaultValue={item.icon ?? ""}
								/>
							</div>
							<button
								type="submit"
								className="px-3 py-1 bg-blue-600 text-white rounded-sm text-sm hover:bg-blue-700"
							>
								{t("admin.menuTableReact.save")}
							</button>
						</form>
					))}
			</div>
		</DragDropProvider>
	);
};
