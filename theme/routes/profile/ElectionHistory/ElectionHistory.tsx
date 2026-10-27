import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type { ProfileElectionGroup } from "~/contracts/profile";
import { PrivacyBadge } from "~theme/shared/PrivacyBadge/PrivacyBadge";

const statusCls = (status: string) => {
	if (status === "approved") return "bg-success-bg text-success";
	if (status === "rejected") return "bg-error-bg text-error";
	return "bg-warning-bg text-warning";
};

/** The owner's election applications by cycle (elections module, own profile only). */
export const ElectionHistory = component$<{ groups: ProfileElectionGroup[] }>(
	({ groups }) =>
		groups.length === 0 ? null : (
			<section class="border-l-4 border-info-border bg-info-bg/40 rounded-r-lg pl-4 py-4">
				<div class="flex items-center gap-2 mb-3">
					<h2 class="text-xl font-semibold text-text">
						{t("theme.userProfile.electionHistory")}
					</h2>
					<PrivacyBadge />
				</div>
				<div class="space-y-3">
					{groups.map((group) => (
						<div
							key={group.title}
							class="border border-border rounded-lg overflow-hidden bg-white"
						>
							<div class="px-4 py-2 bg-bg border-b text-sm font-medium text-text-secondary">
								{group.title}
							</div>
							<ul class="divide-y divide-gray-100">
								{group.apps.map((app) => (
									<li
										key={app.id}
										class="px-4 py-3 flex items-center justify-between"
									>
										<span class="text-sm text-text">
											{app.position?.title ?? "—"}
										</span>
										<span
											class={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls(app.status)}`}
										>
											{app.status}
										</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>
		),
);
