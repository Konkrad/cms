import { $, component$, useSignal } from "@qwik.dev/core";
import { Form, Link } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import type {
	EventViewData,
	UpdateParticipationAction,
} from "~/contracts/events";
import { EventDateTile } from "~theme/blocks/FeatureBlock/EventDateTile";
import { FeatureGrid } from "~theme/blocks/FeatureBlock/FeatureGrid";
import { ImageTile } from "~theme/blocks/FeatureBlock/ImageTile";
import { LocationTile } from "~theme/blocks/FeatureBlock/LocationTile";
import { ParticipantsTile } from "~theme/blocks/FeatureBlock/ParticipantsTile";
import { ParticipantsModal } from "~theme/shared/ParticipantsModal";
import { ParticipationToggle } from "~theme/shared/ParticipationToggle/ParticipationToggle";

/** Themed view for the public event detail route (`/events/[id]`). */
export const EventView = component$<{
	event: EventViewData;
	updateParticipation: UpdateParticipationAction;
	s3BaseUrl: string;
}>(({ event: eventData, updateParticipation, s3BaseUrl }) => {
	if (!eventData) {
		return (
			<div class="max-w-4xl mx-auto px-4 py-16 text-center">
				<h1 class="text-4xl font-bold text-text-heading mb-4">
					Event Not Found
				</h1>
				<p class="text-text-secondary mb-8">
					The event you're looking for doesn't exist or has been removed.
				</p>
				<Link
					href="/events"
					class="text-primary hover:text-primary font-medium"
				>
					Back to Events
				</Link>
			</div>
		);
	}

	const event = eventData;
	const startDate = new Date(event.startDate);
	const endDate = new Date(event.endDate);

	const hasProducts = event.products.length > 0;

	const showFreeRSVP =
		!event.isEventPast &&
		hasProducts &&
		event.isFreeEvent &&
		event.hasSingleProduct &&
		event.activeSalesPeriod &&
		!event.soldOut;

	const showWaitlist =
		!event.isEventPast &&
		event.isEventFuture &&
		(!event.activeSalesPeriod || !hasProducts) &&
		!event.soldOut;

	const showBuyTickets =
		!event.isEventPast &&
		hasProducts &&
		event.activeSalesPeriod &&
		!event.soldOut &&
		(!event.isFreeEvent || !event.hasSingleProduct);

	const showSalesClosed =
		!event.isEventPast &&
		hasProducts &&
		event.pastSalesPeriod &&
		!event.activeSalesPeriod &&
		event.isEventFuture;

	const participantCount =
		event.participationSummary.yes + event.participationSummary.maybe;

	const mapImage =
		event.locationType === "online"
			? "/online.png"
			: (event.mapImageUrl ?? "https://picsum.photos/600/600?grayscale");

	const showParticipantsModal = useSignal(false);
	const optimisticParticipationStatus = useSignal<
		"yes" | "no" | "maybe" | null
	>(null);

	const effectiveParticipationStatus =
		optimisticParticipationStatus.value ??
		event.userParticipation?.status ??
		null;

	return (
		<div class="min-h-screen bg-white">
			<div class="max-w-[1290px] mx-auto px-4 py-12">
				{/* ── Title ── */}
				<h1 class="font-['Rubik',sans-serif] font-bold text-[48px] md:text-[64px] leading-[1.1] text-center text-black mb-8">
					{event.title}
				</h1>

				{/* ── Description ── */}
				{event.body && (
					<p class="max-w-3xl mx-auto text-center text-text-secondary text-base leading-relaxed mb-10">
						{event.body}
					</p>
				)}

				{/* ── CTA Button ── */}
				{!event.isEventPast && (
					<div class="flex justify-center mb-12">
						{!event.isLoggedIn ? (
							<a
								href="/login"
								class="inline-block px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
							>
								Log In to RSVP
							</a>
						) : showBuyTickets ? (
							<Link
								href={`/events/${event.id}/checkout`}
								class="inline-block px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
							>
								Buy Your Tickets
							</Link>
						) : showWaitlist ? (
							<Form action={updateParticipation}>
								{event.isFreeEvent &&
									event.hasSingleProduct &&
									event.products[0]?.id && (
										<input
											type="hidden"
											name="productId"
											value={event.products[0].id}
										/>
									)}
								<Button
									type="submit"
									name="status"
									value="maybe"
									size="lg"
									disabled={updateParticipation.isRunning}
								>
									{effectiveParticipationStatus === "maybe"
										? "✓ On Waitlist"
										: "Join Waitlist"}
								</Button>
							</Form>
						) : showSalesClosed ? (
							<span class="inline-block px-10 py-3 bg-bg-muted text-white font-['Lato',sans-serif] font-bold text-sm rounded-full cursor-not-allowed">
								Sales Closed
							</span>
						) : event.soldOut ? (
							// bg-orange-500: "Sold Out" visual indicator; no orange token in current palette, would need --color-orange-* added to theme.css if themes want different highlight
							<span class="inline-block px-10 py-3 bg-orange-500 text-white font-['Lato',sans-serif] font-bold text-sm rounded-full cursor-not-allowed">
								Sold Out
							</span>
						) : (
							<Form action={updateParticipation}>
								{event.isFreeEvent &&
									event.hasSingleProduct &&
									event.products[0]?.id && (
										<input
											type="hidden"
											name="productId"
											value={event.products[0].id}
										/>
									)}
								<ParticipationToggle
									currentStatus={effectiveParticipationStatus}
									disabled={updateParticipation.isRunning}
									onStatusChange={$((status: "yes" | "no" | "maybe") => {
										optimisticParticipationStatus.value = status;
									})}
								/>
							</Form>
						)}
					</div>
				)}

				{updateParticipation.value &&
					"message" in updateParticipation.value && (
						<div class="max-w-xl mx-auto mb-8 p-3 bg-error-bg border border-error-border rounded-lg text-error text-center text-sm">
							{updateParticipation.value.message}
						</div>
					)}

				{/* RSVP confirmation messages */}
				{effectiveParticipationStatus === "yes" && showFreeRSVP && (
					<div class="max-w-xl mx-auto mb-8 p-3 bg-success-bg border border-success-border rounded-lg text-success text-center text-sm">
						✓ You're attending! Your free ticket has been created.
					</div>
				)}
				{effectiveParticipationStatus === "maybe" && showWaitlist && (
					<div class="max-w-xl mx-auto mb-8 p-3 bg-info-bg border border-info-border rounded-lg text-primary text-center text-sm">
						✓ You're on the waitlist!
					</div>
				)}

				{/* ── Feature Grid ── */}
				<FeatureGrid gap={20}>
					{/* Top-left: Save the Date */}
					<EventDateTile
						area="left-top"
						startDate={startDate}
						endDate={endDate}
						variant="dark"
						title={event.title}
						location={event.locationDisplay}
						description={event.body || undefined}
						isPast={event.isEventPast}
					/>

					{/* Center: Location Map */}
					{event.locationDisplay ? (
						<LocationTile
							area="middle"
							image={mapImage}
							location={event.locationDisplay}
							lat={
								event.locationType !== "online" && event.latitude
									? parseFloat(event.latitude)
									: undefined
							}
							lng={
								event.locationType !== "online" && event.longitude
									? parseFloat(event.longitude)
									: undefined
							}
						/>
					) : (
						<ImageTile
							area="middle"
							image="https://picsum.photos/600/700"
							alt="Event"
							s3BaseUrl={s3BaseUrl}
						/>
					)}

					{/* Top-right: Event Image */}
					{event.image2 && (
						<ImageTile
							area="right-top"
							image={event.image2}
							alt={event.title}
							s3BaseUrl={s3BaseUrl}
						/>
					)}

					{/* Bottom-left: Event Image */}
					{event.image1 && (
						<ImageTile
							area="left-bottom"
							image={event.image1}
							alt={event.title}
							s3BaseUrl={s3BaseUrl}
						/>
					)}

					{/* Bottom-right: Participants */}
					<ParticipantsTile
						area="right-bottom"
						participants={event.participants}
						participantCount={participantCount}
						summaryLine={`are going to ${event.title}`}
						emptyBody={`Join ${event.title} and invite your friends`}
						isLoggedIn={event.isLoggedIn}
						onSeeAll$={$(() => {
							showParticipantsModal.value = true;
						})}
						variant="dark"
					/>
				</FeatureGrid>

				{/* Participants modal */}
				{showParticipantsModal.value && (
					<ParticipantsModal
						participants={event.participants}
						eventName={event.title}
						onClose$={$(() => {
							showParticipantsModal.value = false;
						})}
					/>
				)}

				{/* ── Tickets / What's Included Section ── */}
				{hasProducts && !event.isEventPast && (
					<div class="max-w-4xl mx-auto mt-16">
						<h2 class="font-['Rubik',sans-serif] font-bold text-[32px] leading-[1.3] text-black mb-6">
							Tickets
						</h2>
						<p class="text-text-secondary text-base leading-relaxed mb-4">
							What is included in your tickets:
						</p>
						<div class="space-y-4">
							{event.products.map((product) => (
								<div key={product.id} class="flex items-start gap-3">
									<span class="text-text-muted mt-0.5">•</span>
									<div>
										<span class="font-medium text-text-heading">
											{product.name}
										</span>
										{product.price > 0 && (
											<span class="text-text-muted ml-2">
												— €{product.price.toFixed(2)}
											</span>
										)}
										{product.features &&
											(product.features as string[]).length > 0 && (
												<ul class="mt-1 ml-2 space-y-1">
													{(product.features as string[]).map(
														(feature, idx) => (
															<li
																key={idx}
																class="text-sm text-text-secondary flex items-start gap-2"
															>
																<span class="text-border">·</span>
																{feature}
															</li>
														),
													)}
												</ul>
											)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Photo Gallery (past events, verified attendees) ── */}
				{event.isEventPast && event.hasAttended && (
					// Purple color palette for photo gallery feature highlight; no purple token in current palette, intentional visual distinction
					<div class="max-w-4xl mx-auto mt-16 bg-purple-50 border border-purple-200 rounded-[25px] p-8">
						<h3 class="font-['Rubik',sans-serif] font-semibold text-[24px] text-purple-900 mb-3">
							📸 Event Photos
						</h3>
						<p class="text-purple-800 mb-6">
							You attended this event! View the photo gallery with all the
							memories.
						</p>
						<Link
							href={`/events/${event.id}/photos`}
							class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-full transition-colors"
						>
							View Photo Gallery
						</Link>
					</div>
				)}

				{/* ── Organizer ── */}
				<div class="max-w-4xl mx-auto mt-16">
					<h2 class="font-['Rubik',sans-serif] font-bold text-[24px] leading-[1.3] text-black mb-4">
						Organized by
					</h2>
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 bg-[#034ea2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
							{event.user.displayName.charAt(0).toUpperCase()}
						</div>
						<div>
							<a
								href={`/users/${event.user.id}`}
								class="font-medium text-text-heading text-lg hover:text-primary hover:underline"
							>
								{event.user.displayName}
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
});
