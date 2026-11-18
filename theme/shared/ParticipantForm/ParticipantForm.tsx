import { component$, type QRL, useStore } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { SearchUserResult } from "~theme/routes/events/checkout/types";

export type ParticipantFormSlot = {
	name: string;
	email: string;
	existingUserId?: string | null;
	/** Id of the ticket participant this slot keeps (its email stays server-side). */
	participantId?: string | null;
	locked?: boolean;
};

type ParticipantFormProps = {
	slots: ParticipantFormSlot[];
	totalSlots: number;
	buyer?: { name: string; avatarUrl: string | null };
	/** Participants already assigned elsewhere, shown as quick-picks */
	previouslyAdded?: ParticipantFormSlot[];
	onSlotsChange$: QRL<(slots: ParticipantFormSlot[]) => void>;
};

export const ParticipantForm = component$<ParticipantFormProps>(
	({ slots, totalSlots, buyer, previouslyAdded = [], onSlotsChange$ }) => {
		const ui = useStore<{
			focused: boolean;
			manualMode: boolean;
			manualName: string;
			manualEmail: string;
			searchQuery: string;
			searchResults: SearchUserResult[];
			searchLoading: boolean;
			searchError: string;
		}>({
			focused: false,
			manualMode: false,
			manualName: "",
			manualEmail: "",
			searchQuery: "",
			searchResults: [],
			searchLoading: false,
			searchError: "",
		});

		const assignedCount = slots.filter(
			(s) => s.name || s.existingUserId,
		).length;
		const hasOpenSlot = assignedCount < totalSlots;

		return (
			<div class="space-y-4">
				{/* Assigned participants */}
				{slots.some((s) => s.locked || s.name || s.existingUserId) && (
					<div class="space-y-2">
						{slots.map((slot, idx) => {
							if (!slot.locked && !slot.name && !slot.existingUserId)
								return null;
							return (
								<div
									key={idx}
									class="flex items-center gap-3 py-2 border-b last:border-b-0"
								>
									{slot.locked && buyer?.avatarUrl ? (
										<img
											src={buyer.avatarUrl}
											alt={buyer.name}
											width={32}
											height={32}
											class="w-8 h-8 rounded-full object-cover flex-shrink-0"
										/>
									) : (
										<div class="w-8 h-8 rounded-full bg-border flex-shrink-0" />
									)}
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium truncate">
											{slot.locked ? buyer?.name || slot.name : slot.name}
										</p>
										<p class="text-xs text-text-muted">
											{t("theme.participantForm.participant", {
												value: idx + 1,
											})}
										</p>
									</div>
									<button
										type="button"
										class="text-xs text-error hover:underline flex-shrink-0"
										onClick$={() => {
											const next = slots.map((s, i) =>
												i === idx
													? {
															...s,
															name: "",
															email: "",
															existingUserId: null,
															participantId: null,
															locked: false,
														}
													: s,
											);
											onSlotsChange$(next);
										}}
									>
										{t("theme.participantForm.remove")}
									</button>
								</div>
							);
						})}
					</div>
				)}

				{/* Search / manual entry — only when open slots exist */}
				{hasOpenSlot && (
					<div class="space-y-2">
						{ui.manualMode ? (
							<div class="border rounded-lg p-3 space-y-2 bg-bg">
								<p class="text-xs font-medium text-text-secondary">
									{t("theme.participantForm.addParticipantManually")}
								</p>
								<input
									type="text"
									class="w-full px-3 py-2 border rounded-lg text-sm"
									placeholder={t("theme.participantForm.fullName")}
									value={ui.manualName}
									onInput$={(_, el) => {
										ui.manualName = el.value;
									}}
								/>
								<input
									type="email"
									class="w-full px-3 py-2 border rounded-lg text-sm"
									placeholder={t("theme.participantForm.emailAddress")}
									value={ui.manualEmail}
									onInput$={(_, el) => {
										ui.manualEmail = el.value;
									}}
								/>
								<div class="flex gap-2">
									<button
										type="button"
										class="text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:bg-text-heading disabled:opacity-40"
										disabled={
											!ui.manualName.trim() ||
											!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ui.manualEmail)
										}
										onClick$={() => {
											const name = ui.manualName.trim();
											const email = ui.manualEmail.trim();
											if (!name || !email) return;
											let filled = false;
											const next = slots.map((s) => {
												if (filled || s.locked || s.name || s.existingUserId)
													return s;
												filled = true;
												return {
													...s,
													name,
													email,
													existingUserId: null,
													participantId: null,
												};
											});
											onSlotsChange$(next);
											ui.manualMode = false;
											ui.manualName = "";
											ui.manualEmail = "";
										}}
									>
										{t("theme.participantForm.add")}
									</button>
									<button
										type="button"
										class="text-sm px-3 py-1.5 rounded-lg border hover:bg-bg-muted"
										onClick$={() => {
											ui.manualMode = false;
											ui.manualName = "";
											ui.manualEmail = "";
										}}
									>
										{t("theme.participantForm.cancel")}
									</button>
								</div>
							</div>
						) : (
							<div>
								<input
									type="text"
									value={ui.searchQuery}
									class="w-full px-3 py-2 border rounded-lg text-sm"
									placeholder={t(
										"theme.participantForm.searchParticipantByName",
									)}
									onFocus$={() => {
										ui.focused = true;
									}}
									onBlur$={() => {
										ui.focused = false;
									}}
									onInput$={async (_, el) => {
										const q = el.value;
										ui.searchQuery = q;

										if (q.trim().length < 2) {
											ui.searchResults = [];
											ui.searchLoading = false;
											ui.searchError = "";
											return;
										}

										ui.searchLoading = true;
										ui.searchError = "";

										try {
											const resp = await fetch(
												`/api/users/search?q=${encodeURIComponent(q.trim())}`,
												{
													method: "GET",
													credentials: "same-origin",
													headers: { Accept: "application/json" },
												},
											);

											if (!resp.ok) {
												ui.searchResults = [];
												ui.searchError =
													resp.status === 401
														? t("theme.participantForm.pleaseLogInAgainTo")
														: t(
																"theme.participantForm.userSearchFailedPleaseTry",
															);
												return;
											}

											const payload = await resp.json();
											ui.searchResults = (payload?.users ||
												[]) as SearchUserResult[];
										} catch {
											ui.searchResults = [];
											ui.searchError = t(
												"theme.participantForm.userSearchFailedPleaseTry",
											);
										} finally {
											ui.searchLoading = false;
										}
									}}
								/>

								{ui.searchLoading && (
									<p class="text-xs text-text-muted mt-1">
										{t("theme.participantForm.searching")}
									</p>
								)}
								{!ui.searchLoading && ui.searchError && (
									<p class="text-xs text-error mt-1">{ui.searchError}</p>
								)}

								{(ui.focused || ui.searchResults.length > 0) && (
									<div class="border rounded-lg overflow-hidden mt-1">
										{/* Manual entry — always first */}
										<button
											type="button"
											class="w-full px-3 py-2 text-left hover:bg-bg border-b flex items-center gap-3"
											onMouseDown$={(e) => {
												e.preventDefault();
											}}
											onClick$={() => {
												ui.manualMode = true;
												ui.focused = false;
												ui.searchQuery = "";
												ui.searchResults = [];
											}}
										>
											<div class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center flex-shrink-0 text-text-muted text-lg leading-none">
												+
											</div>
											<div>
												<p class="text-sm font-medium">
													{t("theme.participantForm.addManually")}
												</p>
												<p class="text-xs text-text-muted">
													{t("theme.participantForm.enterNameAndEmailAddress")}
												</p>
											</div>
										</button>

										{/* Search results */}
										{ui.searchResults.map((user) => (
											<button
												key={user.id}
												type="button"
												class="w-full px-3 py-2 text-left hover:bg-bg border-b last:border-b-0 flex items-center gap-3"
												onMouseDown$={(e) => {
													e.preventDefault();
												}}
												onClick$={() => {
													let filled = false;
													const next = slots.map((s) => {
														if (
															filled ||
															s.locked ||
															s.name ||
															s.existingUserId
														)
															return s;
														filled = true;
														return {
															...s,
															name: user.displayName,
															// Email is intentionally not exposed by the search
															// API; it is resolved server-side from existingUserId
															// at checkout.
															email: "",
															existingUserId: user.id,
															participantId: null,
														};
													});
													onSlotsChange$(next);
													ui.searchQuery = "";
													ui.searchResults = [];
													ui.focused = false;
												}}
											>
												{user.avatarUrl ? (
													<img
														src={user.avatarUrl}
														alt={user.displayName}
														width={32}
														height={32}
														class="w-8 h-8 rounded-full object-cover flex-shrink-0"
													/>
												) : (
													<div class="w-8 h-8 rounded-full bg-border flex-shrink-0" />
												)}
												<div class="min-w-0">
													<p class="text-sm font-medium truncate">
														{user.displayName}
													</p>
												</div>
											</button>
										))}

										{/* Previously added quick-picks (shown only when no search results) */}
										{ui.searchResults.length === 0 &&
											previouslyAdded.length > 0 && (
												<>
													<p class="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide bg-bg">
														{t("theme.participantForm.previouslyAdded")}
													</p>
													{previouslyAdded.map((p, i) => (
														<button
															key={i}
															type="button"
															class="w-full px-3 py-2 text-left hover:bg-bg border-b last:border-b-0 flex items-center gap-3"
															onMouseDown$={(e) => {
																e.preventDefault();
															}}
															onClick$={() => {
																let filled = false;
																const next = slots.map((s) => {
																	if (
																		filled ||
																		s.locked ||
																		s.name ||
																		s.existingUserId
																	)
																		return s;
																	filled = true;
																	return {
																		...s,
																		name: p.name,
																		email: p.email,
																		existingUserId: p.existingUserId ?? null,
																		participantId: null,
																	};
																});
																onSlotsChange$(next);
																ui.focused = false;
															}}
														>
															<div class="w-8 h-8 rounded-full bg-border flex-shrink-0" />
															<div class="min-w-0">
																<p class="text-sm font-medium truncate">
																	{p.name}
																</p>
																<p class="text-xs text-text-muted truncate">
																	{p.email}
																</p>
															</div>
														</button>
													))}
												</>
											)}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		);
	},
);
