import { $, component$, useSignal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import type { GroupViewData, JoinGroupAction } from "~/contracts/groups";
import { FeatureGrid } from "~theme/blocks/FeatureBlock/FeatureGrid";
import { ImageTile } from "~theme/blocks/FeatureBlock/ImageTile";
import { LocalRepTile } from "~theme/blocks/FeatureBlock/LocalRepTile";
import { ParticipantsTile } from "~theme/blocks/FeatureBlock/ParticipantsTile";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { ParticipantsModal } from "~theme/shared/ParticipantsModal";

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

/** Themed view for the public group page (`/groups/[slug]`). */
export const GroupView = component$<{
	data: GroupViewData;
	joinAction: JoinGroupAction;
	s3BaseUrl: string;
}>(({ data, joinAction, s3BaseUrl }) => {
	const showMembersModal = useSignal(false);
	const {
		group,
		memberCount,
		pastEventCount,
		recentMembers,
		rep,
		isMember,
		isLoggedIn,
		upcomingEvents,
		recentPosts,
		groupImage1,
		groupImage2,
		groupImage3,
	} = data;

	return (
		<div>
			{/* Heading */}
			<div class="max-w-[1290px] mx-auto px-4 pt-12 pb-4 text-center">
				<h1 class="font-semibold text-[40px] md:text-[52px] leading-[1.1] text-text-heading">
					{group.name}
				</h1>
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
						image={groupImage1 ?? FALLBACK}
						alt={group.name}
						s3BaseUrl={s3BaseUrl}
					/>

					<ImageTile
						area="middle"
						image={groupImage2 ?? FALLBACK}
						alt={group.name}
						overlayText={`${pastEventCount} local meet-up${pastEventCount === 1 ? "" : "s"} and counting`}
						s3BaseUrl={s3BaseUrl}
					/>

					<ImageTile
						area="right-top"
						image={groupImage3 ?? FALLBACK}
						alt={group.name}
						s3BaseUrl={s3BaseUrl}
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
									title={e.title}
									image={e.image1 ?? undefined}
									date={formatEventDate(e.startDate, e.endDate)}
									meta={location}
									href={`/events/${e.id}`}
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
					<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{recentPosts.map((p: any) => (
							<ContentCard
								key={p.id}
								date={new Date(p.createdAt).toLocaleDateString("en-GB", {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
								title={p.title}
								image={p.featuredImage ?? undefined}
								description={p.body.replace(/<[^>]+>/g, "").substring(0, 150)}
								href={`/posts/${p.id}`}
							/>
						))}
					</div>
				</div>
			)}
			{/* Members modal */}
			{showMembersModal.value && (
				<ParticipantsModal
					participants={recentMembers}
					eventName={`${group.name} Community`}
					onClose$={$(() => {
						showMembersModal.value = false;
					})}
				/>
			)}
		</div>
	);
});
