import { $, component$, useSignal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { t } from "~/contracts/i18n";
import type { JoinScopeAction, ScopeViewData } from "~/contracts/scopes";
import { FeatureGrid } from "~theme/blocks/FeatureBlock/FeatureGrid";
import { ImageTile } from "~theme/blocks/FeatureBlock/ImageTile";
import { LocalRepTile } from "~theme/blocks/FeatureBlock/LocalRepTile";
import { ParticipantsTile } from "~theme/blocks/FeatureBlock/ParticipantsTile";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { formatEventWhen } from "~theme/shared/format-event-when";
import { ParticipantsModal } from "~theme/shared/ParticipantsModal";
import { StreamList } from "~theme/shared/StreamList/StreamList";

const GRID_LAYOUT = `"left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"`;
const FALLBACK =
	"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800";

/** Themed view for a scope's public home page (`/germany/berlin`): a group, region or chapter. */
export const ScopeView = component$<{
	data: ScopeViewData;
	joinAction: JoinScopeAction;
}>(({ data, joinAction }) => {
	const showMembersModal = useSignal(false);
	const {
		scope,
		parents,
		childScopes,
		memberCount,
		pastEventCount,
		recentMembers,
		rep,
		isMember,
		isLoggedIn,
		upcomingEvents,
		recentNews,
		image1,
		image2,
		image3,
	} = data;

	return (
		<div>
			{/* Heading */}
			<div class="max-w-[1290px] mx-auto px-4 pt-12 pb-4 text-center">
				{parents.length > 0 && (
					<nav
						aria-label={t("theme.scope.breadcrumb")}
						class="text-sm text-text-muted mb-2"
					>
						{parents.map((p, i) => (
							<span key={p.url}>
								{i > 0 && " / "}
								<a href={p.url} class="hover:underline">
									{p.name}
								</a>
							</span>
						))}
					</nav>
				)}
				<h1 class="font-semibold text-[40px] md:text-[52px] leading-[1.1] text-text-heading">
					{scope.name}
				</h1>
				{scope.description && (
					<p class="mt-4 text-text-secondary max-w-2xl mx-auto">
						{scope.description}
					</p>
				)}
			</div>

			{/* Feature Grid */}
			<div class="max-w-[1290px] mx-auto px-4 py-8">
				<FeatureGrid layout={GRID_LAYOUT} gap={24}>
					<ParticipantsTile
						area="left-top"
						participants={recentMembers}
						participantCount={memberCount}
						title={t("theme.scope.communityMembers")}
						seeAllLabel={t("theme.scope.seeAllMembers")}
						onSeeAll$={$(() => {
							showMembersModal.value = true;
						})}
						emptyTitle={t("theme.scope.noMembersYet")}
						emptyBody={t("theme.scope.beTheFirstToJoin")}
						isLoggedIn={isLoggedIn}
					/>

					<ImageTile
						area="left-bottom"
						image={image1 ?? FALLBACK}
						alt={scope.name}
					/>

					<ImageTile
						area="middle"
						image={image2 ?? FALLBACK}
						alt={scope.name}
						overlayText={t("theme.scope.meetUpsAndCounting", {
							count: pastEventCount,
						})}
					/>

					<ImageTile
						area="right-top"
						image={image3 ?? FALLBACK}
						alt={scope.name}
					/>

					{rep ? (
						<LocalRepTile
							area="right-bottom"
							name={rep.name}
							subtitle={rep.subtitle}
							profilePictureUrl={rep.profilePictureUrl}
							profileUrl={rep.profileUrl}
						/>
					) : (
						<div
							class="bg-primary p-8 flex flex-col justify-between h-full"
							style={{ gridArea: "right-bottom" }}
						>
							<h3 class="font-semibold text-[24px] text-white">
								{t("theme.scope.joinTheCommunity")}
							</h3>
							{isMember ? (
								<p class="text-[16px] text-white/80 mt-4">
									{t("theme.scope.youAreAMember")}
								</p>
							) : (
								<Form action={joinAction} class="mt-6">
									<Button
										type="submit"
										variant="secondary"
										disabled={joinAction.isRunning}
									>
										{joinAction.isRunning
											? t("theme.scope.joining")
											: t("theme.scope.joinThisGroup")}
									</Button>
								</Form>
							)}
						</div>
					)}
				</FeatureGrid>
			</div>

			{/* Join / member status */}
			{rep && (
				<div class="max-w-[1290px] mx-auto px-4 pb-12 flex flex-col items-center gap-3">
					{isMember ? (
						<div class="bg-success-bg border border-success-border text-success px-6 py-3 font-medium">
							{t("theme.scope.youAreAMemberOf")}
						</div>
					) : (
						<Form action={joinAction}>
							<Button type="submit" size="lg" disabled={joinAction.isRunning}>
								{joinAction.isRunning
									? t("theme.scope.joining")
									: t("theme.scope.joinThisGroup")}
							</Button>
						</Form>
					)}
					{joinAction.value?.error && (
						<p class="text-error text-sm">{joinAction.value.error}</p>
					)}
				</div>
			)}

			{/* Child scopes (e.g. the chapters of a region) */}
			{childScopes.length > 0 && (
				<div class="max-w-[1290px] mx-auto px-4 py-8">
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						{t("theme.scope.localGroups")}
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{childScopes.map((child) => (
							<ContentCard
								key={child.id}
								title={child.name}
								image={child.imageUrl}
								meta={`${child.memberCount} ${child.memberCount === 1 ? "member" : "members"}`}
								href={child.url}
								label={t("theme.scope.viewGroup")}
							/>
						))}
					</div>
				</div>
			)}

			{/* Upcoming Events */}
			{upcomingEvents.length > 0 && (
				<div class="max-w-[1290px] mx-auto px-4 py-8">
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						{t("theme.scope.upcomingCommunityEvents")}
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{upcomingEvents.map((e) => {
							const location =
								e.city ||
								e.address ||
								(e.locationType === "online"
									? t("theme.scope.online")
									: t("theme.scope.tba"));
							return (
								<ContentCard
									key={e.id}
									category={e.source ?? undefined}
									title={e.title}
									image={e.image1 ?? undefined}
									date={formatEventWhen(e.startDate, e.endDate)}
									meta={location}
									href={e.url}
									label={t("theme.scope.openTickets")}
								/>
							);
						})}
					</div>
				</div>
			)}

			{/* Latest notes and articles */}
			{recentNews.length > 0 && (
				<div class="max-w-[1290px] mx-auto px-4 py-8">
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						{t("theme.scope.latestFromTheCommunity")}
					</h2>
					<StreamList items={recentNews} />
				</div>
			)}
			{/* Members modal */}
			{showMembersModal.value && (
				<ParticipantsModal
					participants={recentMembers}
					eventName={t("theme.scope.community", { name: scope.name })}
					onClose$={$(() => {
						showMembersModal.value = false;
					})}
				/>
			)}
		</div>
	);
});
