import { $, component$, useSignal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import type { JoinScopeAction, ScopeViewData } from "~/contracts/scopes";
import { FeatureGrid } from "~theme/blocks/FeatureBlock/FeatureGrid";
import { ImageTile } from "~theme/blocks/FeatureBlock/ImageTile";
import { LocalRepTile } from "~theme/blocks/FeatureBlock/LocalRepTile";
import { ParticipantsTile } from "~theme/blocks/FeatureBlock/ParticipantsTile";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { ParticipantsModal } from "~theme/shared/ParticipantsModal";
import { PostCardList } from "~theme/shared/PostCard/PostCard";

const GRID_LAYOUT = `"left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"`;
const FALLBACK =
	"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800";

function formatEventDate(startDate: string, endDate?: string): string {
	const start = new Date(startDate);
	const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(
		start,
	);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		start,
	);
	const startTime = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(start);

	if (!endDate) {
		return `${day} ${month} · ${startTime}`;
	}

	const endTime = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(new Date(endDate));

	return `${day} ${month} · ${startTime} - ${endTime}`;
}

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
		recentPosts,
		image1,
		image2,
		image3,
	} = data;

	return (
		<div>
			{/* Heading */}
			<div class="max-w-[1290px] mx-auto px-4 pt-12 pb-4 text-center">
				{parents.length > 0 && (
					<nav aria-label="Breadcrumb" class="text-sm text-text-muted mb-2">
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
						title="Community Members"
						seeAllLabel="See All Members"
						onSeeAll$={$(() => {
							showMembersModal.value = true;
						})}
						emptyTitle="No members yet"
						emptyBody="Be the first to join this community"
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
						overlayText={`${pastEventCount} local meet-up${pastEventCount === 1 ? "" : "s"} and counting`}
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
								Join the community
							</h3>
							{isMember ? (
								<p class="text-[16px] text-white/80 mt-4">✓ You are a member</p>
							) : (
								<Form action={joinAction} class="mt-6">
									<Button
										type="submit"
										variant="secondary"
										disabled={joinAction.isRunning}
									>
										{joinAction.isRunning ? "Joining..." : "Join This Group"}
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
							✓ You are a member of this group
						</div>
					) : (
						<Form action={joinAction}>
							<Button type="submit" size="lg" disabled={joinAction.isRunning}>
								{joinAction.isRunning ? "Joining..." : "Join This Group"}
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
						Local Groups
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{childScopes.map((child) => (
							<ContentCard
								key={child.id}
								title={child.name}
								image={child.imageUrl}
								meta={`${child.memberCount} ${child.memberCount === 1 ? "member" : "members"}`}
								href={child.url}
								label="View Group"
							/>
						))}
					</div>
				</div>
			)}

			{/* Upcoming Events */}
			{upcomingEvents.length > 0 && (
				<div class="max-w-[1290px] mx-auto px-4 py-8">
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						Upcoming Community Events
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{upcomingEvents.map((e) => {
							const location =
								e.city ||
								e.address ||
								(e.locationType === "online" ? "Online" : "TBA");
							return (
								<ContentCard
									key={e.id}
									category={e.source ?? undefined}
									title={e.title}
									image={e.image1 ?? undefined}
									date={formatEventDate(e.startDate, e.endDate)}
									meta={location}
									href={e.url}
									label="Open Tickets"
								/>
							);
						})}
					</div>
				</div>
			)}

			{/* Recent Posts */}
			{recentPosts.length > 0 && (
				<div class="max-w-[1290px] mx-auto px-4 py-8">
					<h2 class="font-semibold text-[32px] text-text-heading mb-6">
						Latest from the Community
					</h2>
					<PostCardList posts={recentPosts} />
				</div>
			)}
			{/* Members modal */}
			{showMembersModal.value && (
				<ParticipantsModal
					participants={recentMembers}
					eventName={`${scope.name} Community`}
					onClose$={$(() => {
						showMembersModal.value = false;
					})}
				/>
			)}
		</div>
	);
});
