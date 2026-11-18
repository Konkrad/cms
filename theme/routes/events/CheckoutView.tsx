import {
	$,
	component$,
	useComputed$,
	useSignal,
	useVisibleTask$,
} from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type {
	CheckoutData,
	CreateCheckoutSessionAction,
	SubmitRequirementAction,
} from "~/contracts/checkout";
import { formatCurrency, t } from "~/contracts/i18n";
import { validateParticipantSlots } from "~/modules/events/participant-validation";
import { ParticipantAssignmentStep } from "~theme/routes/events/checkout/ParticipantAssignmentStep";
import { ProductSelectionStep } from "~theme/routes/events/checkout/ProductSelectionStep";
import { StepIndicator } from "~theme/routes/events/checkout/StepIndicator";
import type {
	GroupedAssignments,
	ParticipantAssignmentUnit,
	ParticipantSlotInput,
} from "~theme/routes/events/checkout/types";
import { RequirementSteps } from "~theme/shared/RequirementStep/RequirementStep";

/**
 * Themed view for the ticket purchase flow (`/events/[id]/checkout`). Paid orders continue on
 * the payment provider's page; back here, `data.payment` is the status core knows from the
 * provider (the return itself proves nothing).
 */
export const CheckoutView = component$<{
	data: CheckoutData;
	createCheckoutSession: CreateCheckoutSessionAction;
	submitRequirement: SubmitRequirementAction;
}>(({ data: dataValue, createCheckoutSession, submitRequirement }) => {
	const data = dataValue;

	const currentStep = useSignal<1 | 2 | 3 | 4>(data.payment ? 4 : 1);
	const selectedProducts = useSignal<Record<string, number>>({});
	const participantAssignments = useSignal<ParticipantAssignmentUnit[]>([]);
	const freeSubmitted = useSignal(false);
	const isProcessing = useSignal(false);
	const paymentError = useSignal<string>("");

	const calculateTotal = useComputed$(() => {
		let total = 0;
		for (const [productId, quantity] of Object.entries(
			selectedProducts.value,
		)) {
			const product = data.groups
				.flatMap((g) => g.products || [])
				.find((p) => p.id === productId);
			if (product) {
				total += product.price * quantity;
			}
		}
		return total;
	});

	const selectedProductDetails = useComputed$(() => {
		return Object.entries(selectedProducts.value)
			.map(([productId, quantity]) => {
				const product = data.groups
					.flatMap((g) => g.products || [])
					.find((p) => p.id === productId);
				return product ? { ...product, quantity } : null;
			})
			.filter((p) => p !== null);
	});

	const canProceedFromProducts = useComputed$(() => {
		return Object.values(selectedProducts.value).some(
			(quantity) => quantity > 0,
		);
	});

	const totalTickets = useComputed$(() => {
		return Object.values(selectedProducts.value).reduce(
			(sum, value) => sum + value,
			0,
		);
	});

	const participantAssignmentsByProduct = useComputed$(() => {
		const grouped = new Map<string, GroupedAssignments>();

		for (const unit of participantAssignments.value) {
			const existing = grouped.get(unit.productId);
			if (existing) {
				existing.units.push(unit);
			} else {
				grouped.set(unit.productId, {
					productId: unit.productId,
					productName: unit.productName,
					units: [unit],
				});
			}
		}

		return Array.from(grouped.values());
	});

	const handleSelectionChange = $((next: Record<string, number>) => {
		selectedProducts.value = next;
	});

	const handleStartParticipants = $((units: ParticipantAssignmentUnit[]) => {
		participantAssignments.value = units;
		currentStep.value = 2;
		paymentError.value = "";
	});

	const handleAssignmentsChange = $((next: ParticipantAssignmentUnit[]) => {
		participantAssignments.value = next;
	});

	const handleBackToProducts = $(() => {
		currentStep.value = 1;
		paymentError.value = "";
	});

	const handleContinueToPayment = $(() => {
		const error = validateParticipantSlots(participantAssignments.value);
		if (error) {
			paymentError.value = error;
			return;
		}
		paymentError.value = "";
		currentStep.value = 3;
	});

	const cartItems = $(() => {
		const participantByProduct = participantAssignments.value.reduce(
			(acc, unit) => {
				if (!acc[unit.productId]) {
					acc[unit.productId] = [];
				}
				acc[unit.productId].push(
					unit.slots
						.filter((slot) => slot.name.trim() || slot.email.trim())
						.map((slot) => ({
							name: slot.name,
							email: slot.email,
							existingUserId: slot.existingUserId || null,
						})),
				);
				return acc;
			},
			{} as Record<string, ParticipantSlotInput[][]>,
		);

		return Object.entries(selectedProducts.value)
			.map(([productId, quantity]) => ({
				productId,
				quantity,
				participantUnits: participantByProduct[productId] || [],
			}))
			.filter((item) => item.quantity > 0);
	});

	/** Free orders complete here; paid ones continue on the provider's checkout page. */
	const submitOrder = $(async () => {
		isProcessing.value = true;
		paymentError.value = "";
		const result = await createCheckoutSession.submit({
			items: JSON.stringify(await cartItems()),
		});
		if (result.value?.failed) {
			paymentError.value =
				result.value.message || t("theme.checkout.failedToPrepareCheckout");
			isProcessing.value = false;
			return;
		}
		if (result.value?.tickets) {
			currentStep.value = 4;
			isProcessing.value = false;
			return;
		}
		if (result.value?.checkoutUrl) {
			window.location.assign(result.value.checkoutUrl);
			return;
		}
		isProcessing.value = false;
	});

	// Free orders need no payment step: book them as soon as the payment step is reached.
	// biome-ignore lint/correctness/noQwikUseVisibleTask: submits from the browser once step 3 shows
	useVisibleTask$(async ({ track }) => {
		track(() => currentStep.value);
		if (
			currentStep.value === 3 &&
			calculateTotal.value === 0 &&
			!freeSubmitted.value
		) {
			freeSubmitted.value = true;
			await submitOrder();
		}
	});

	const paymentState = data.payment
		? data.payment.status === "paid"
			? "paid"
			: data.payment.status === "pending" && !data.payment.canceled
				? "processing"
				: "unpaid"
		: "paid";

	return (
		<div class="max-w-4xl mx-auto p-6">
			<h1 class="text-3xl font-bold mb-6">
				{t("theme.checkout.purchaseTickets")}
			</h1>

			{/* What the buyer must answer first (food preference, photo consent …), one step at a time. */}
			{data.requirements.length > 0 ? (
				<div class="space-y-4" data-testid="checkout-requirements">
					<p class="text-text-secondary">
						{t("theme.checkout.beforeYouChooseYourTickets")}
					</p>
					<RequirementSteps
						steps={data.requirements}
						action={submitRequirement}
					/>
				</div>
			) : (
				<StepIndicator currentStep={currentStep.value} />
			)}

			{/* Step 1: Product Selection */}
			{data.requirements.length === 0 && currentStep.value === 1 && (
				<ProductSelectionStep
					groups={data.groups as any[]}
					selectedProducts={selectedProducts.value}
					selectedProductDetails={selectedProductDetails.value as any[]}
					canProceedFromProducts={canProceedFromProducts.value}
					totalTickets={totalTickets.value}
					total={calculateTotal.value}
					buyer={{
						id: data.buyer.id,
						name: data.buyer.name || "",
						email: data.buyer.email || "",
					}}
					onSelectionChange$={handleSelectionChange}
					onContinue$={handleStartParticipants}
				/>
			)}

			{/* Step 2: Participant Assignment */}
			{currentStep.value === 2 && (
				<ParticipantAssignmentStep
					groupedAssignments={participantAssignmentsByProduct.value}
					assignments={participantAssignments.value}
					buyer={{
						name: data.buyer.name || "",
						avatarUrl: data.buyer.avatarUrl,
					}}
					error={paymentError.value || undefined}
					onBack$={handleBackToProducts}
					onContinue$={handleContinueToPayment}
					onAssignmentsChange$={handleAssignmentsChange}
				/>
			)}

			{/* Step 3: Payment */}
			{currentStep.value === 3 && (
				<div class="space-y-6">
					{/* Order Summary */}
					<div class="border rounded-lg p-6 bg-white">
						<h2 class="text-xl font-bold mb-4">
							{t("theme.checkout.orderSummary")}
						</h2>
						<div class="space-y-3">
							{selectedProductDetails.value.map((item: any) => (
								<div key={item.id} class="flex justify-between items-center">
									<div>
										<p class="font-medium">{item.name}</p>
										<p class="text-sm text-text-secondary">
											{t("theme.checkout.quantity", {
												quantity: item.quantity,
											})}
										</p>
									</div>
									<p class="font-bold">
										{formatCurrency(item.price * item.quantity, "EUR")}
									</p>
								</div>
							))}
							<div class="border-t pt-3 mt-3 flex justify-between items-center">
								<span class="text-lg font-bold">
									{t("theme.checkout.total")}
								</span>
								<span class="text-2xl font-bold">
									{formatCurrency(calculateTotal.value, "EUR")}
								</span>
							</div>
						</div>
					</div>

					{/* Payment Form */}
					<div class="border rounded-lg p-6 bg-white">
						<h2 class="text-xl font-bold mb-4">
							{t("theme.checkout.paymentDetails")}
						</h2>

						{paymentError.value && (
							<div class="p-4 bg-error-bg border border-error-border text-error rounded-sm mb-4">
								{paymentError.value}
							</div>
						)}

						<div class="space-y-4">
							<p class="text-sm text-text-secondary">
								{calculateTotal.value === 0
									? t("theme.checkout.bookingYourFreeTickets")
									: t("theme.checkout.youWillContinueToOur")}
							</p>

							<div class="flex gap-4">
								<Button
									type="button"
									variant="secondary"
									class="flex-1"
									disabled={isProcessing.value}
									onClick$={() => {
										currentStep.value = 2;
										freeSubmitted.value = false;
										paymentError.value = "";
									}}
								>
									{t("theme.checkout.back")}
								</Button>
								<Button
									type="button"
									class="flex-1"
									disabled={isProcessing.value || calculateTotal.value === 0}
									onClick$={submitOrder}
								>
									{isProcessing.value ? (
										<span class="flex items-center justify-center gap-2">
											<span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
											{t("theme.checkout.processing")}
										</span>
									) : (
										t("theme.checkout.completePayment")
									)}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Step 4, back from the provider without a confirmed payment */}
			{currentStep.value === 4 && paymentState !== "paid" && (
				<div
					class="border rounded-lg p-6 bg-white text-center space-y-4"
					data-testid="checkout-payment-status"
				>
					{paymentState === "processing" ? (
						<>
							<h2 class="text-2xl font-bold">
								{t("theme.checkout.paymentProcessing")}
							</h2>
							<p class="text-text-secondary">
								{t("theme.checkout.weAreWaitingForThe")}
							</p>
						</>
					) : (
						<>
							<h2 class="text-2xl font-bold">
								{t("theme.checkout.paymentNotCompleted")}
							</h2>
							<p class="text-text-secondary">
								{t("theme.checkout.yourOrderWasNotPaid")}
							</p>
						</>
					)}
					<div class="flex gap-4 justify-center">
						<a
							href="/profile/tickets"
							class="px-6 py-3 bg-primary text-white rounded-sm hover:bg-primary"
						>
							{t("theme.checkout.viewMyTickets")}
						</a>
						<a
							href={data.eventUrl}
							class="px-6 py-3 border border-border-strong rounded-sm hover:bg-bg"
						>
							{t("theme.checkout.backToEvent")}
						</a>
					</div>
				</div>
			)}

			{/* Step 4: Success */}
			{currentStep.value === 4 && paymentState === "paid" && (
				<div class="space-y-6">
					<div class="border rounded-lg p-6 bg-white text-center">
						<div class="text-success text-6xl mb-4">✓</div>
						<h2 class="text-3xl font-bold text-success mb-4">
							{t("theme.checkout.paymentSuccessful")}
						</h2>
						<p class="text-text-secondary text-lg mb-6">
							{t("theme.checkout.thankYouForYourPurchase")}
						</p>
						<div class="p-6 bg-success-bg border border-success-border rounded-sm">
							<h3 class="font-bold mb-2">{t("theme.checkout.whatSNext")}</h3>
							<ul class="text-left space-y-2 text-sm">
								<li>{t("theme.checkout.checkYourEmailForYour")}</li>
								<li>{t("theme.checkout.addTheEventToYour")}</li>
								<li>{t("theme.checkout.presentYourQrCodeAt")}</li>
							</ul>
						</div>
						<div class="flex gap-4 justify-center mt-6">
							<a
								href={`/profile/tickets`}
								class="px-6 py-3 bg-primary text-white rounded-sm hover:bg-primary"
							>
								{t("theme.checkout.viewMyTickets")}
							</a>
							<a
								href={data.eventUrl}
								class="px-6 py-3 border border-border-strong rounded-sm hover:bg-bg"
							>
								{t("theme.checkout.backToEvent")}
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
});
