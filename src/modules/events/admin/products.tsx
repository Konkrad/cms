import { $, component$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { Button, formatCurrency, formatDate, Input, t } from "~/core/ui";
import { InventoryGroupForm } from "../components/InventoryGroupForm";
import { ProductForm } from "../components/ProductForm";
import { inventoryGroupsService } from "../services/inventory-groups";
import { productsService } from "../services/products";
import { requireAdminEvent } from "./event-guards";
import type { AdminProductsData } from "./products-data";

export const useCreateInventoryGroup = routeAction$(
	async (data, event) => {
		await requireAdminEvent(event);
		try {
			const eventId = event.params.id;

			// Validate and transform form data
			// Note: We don't need explicit validation here since zod$ handles it
			const validatedData = data;

			await inventoryGroupsService.create({
				eventId,
				name: validatedData.name.trim(),
				maxCapacity: validatedData.maxCapacity,
				needsTicket: validatedData.needsTicket,
				salesStartDate: validatedData.salesStartDate || undefined,
				salesEndDate: validatedData.salesEndDate || undefined,
			});
			return { success: true };
		} catch (error) {
			console.error("Failed to create inventory group:", error);
			return event.fail(500, {
				message: t("events.admin.products.failedToCreateInventoryGroup"),
			});
		}
	},
	zod$((zod) =>
		zod
			.object({
				name: z.string().min(1, t("events.admin.products.groupNameIsRequired")),
				maxCapacity: z
					.union([
						z.string().transform((val) => parseInt(val, 10)),
						z.number().int(),
					])
					.pipe(
						z
							.number()
							.int()
							.positive(t("events.admin.products.maxCapacityMustBeGreater")),
					),
				needsTicket: z
					.union([
						z.string().transform((val) => val === "on" || val === "true"),
						z.boolean(),
					])
					.default(true),
				salesStartDate: z
					.union([
						z
							.string()
							.transform((val) =>
								val === "" ? undefined : new Date(val).toISOString(),
							),
						z.coerce.date().transform((d) => d.toISOString()),
					])
					.optional(),
				salesEndDate: z
					.union([
						z
							.string()
							.transform((val) =>
								val === "" ? undefined : new Date(val).toISOString(),
							),
						z.coerce.date().transform((d) => d.toISOString()),
					])
					.optional(),
			})
			.superRefine((data, ctx) => {
				if (data.salesStartDate && data.salesEndDate) {
					if (new Date(data.salesStartDate) > new Date(data.salesEndDate)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: t("events.admin.products.salesStartDateMustBe"),
							path: ["salesStartDate"],
						});
					}
				}
			}),
	),
);

export const useCreateProduct = routeAction$(
	async (data, event) => {
		await requireAdminEvent(event);
		try {
			const eventId = event.params.id;

			// Validate and transform form data
			// Note: We don't need explicit validation here since zod$ handles it
			const validatedData = data;

			// The inventory group must belong to this event: a product never crosses events.
			const inventoryGroup = await inventoryGroupsService.getById(
				validatedData.inventoryGroupId,
			);
			if (!inventoryGroup || inventoryGroup.eventId !== eventId) {
				return event.fail(400, {
					message: t("events.admin.products.invalidInventoryGroup"),
				});
			}

			// Convert features string to array
			const features = validatedData.features
				? validatedData.features
						.split(",")
						.map((f: string) => f.trim())
						.filter((f: string) => f.length > 0)
				: [];

			await productsService.create({
				eventId,
				inventoryGroupId: validatedData.inventoryGroupId,
				name: validatedData.name.trim(),
				price: validatedData.price,
				maxQuantity: validatedData.maxQuantity,
				participantCapacity: validatedData.participantCapacity,
				features,
				imageKey: validatedData.imageKey || undefined,
			});
			return { success: true };
		} catch (error) {
			console.error("Failed to create product:", error);
			return event.fail(500, {
				message: t("events.admin.products.failedToCreateProductPlease"),
			});
		}
	},
	zod$((zod) =>
		zod.object({
			inventoryGroupId: z
				.string()
				.uuid(t("events.admin.products.invalidInventoryGroup")),
			name: z.string().min(1, t("events.admin.products.productNameIsRequired")),
			price: z
				.union([z.string().transform((val) => parseFloat(val)), z.number()])
				.pipe(
					z.number().min(0, t("events.admin.products.priceCannotBeNegative")),
				),
			maxQuantity: z
				.union([
					z.string().transform((val) => parseInt(val, 10)),
					z.number().int(),
				])
				.pipe(
					z
						.number()
						.int()
						.min(0, t("events.admin.products.maxQuantityCannotBeNegative")),
				),
			participantCapacity: z
				.union([
					z.string().transform((val) => parseInt(val, 10)),
					z.number().int(),
				])
				.pipe(
					z
						.number()
						.int()
						.min(1, t("events.admin.products.participantCapacityMustBeAt")),
				)
				.default(1),
			features: z.string().default(""),
			imageKey: z.string().optional().or(z.literal("")),
		}),
	),
);

type Props = { data: AdminProductsData };

export const AdminEventProducts = component$<Props>(({ data }) => {
	const createGroup = useCreateInventoryGroup();
	const createProduct = useCreateProduct();

	const showGroupForm = useSignal(false);
	const showProductForm = useSignal(false);
	const selectedGroupId = useSignal<string>("");
	const errorMessage = useSignal("");
	const successMessage = useSignal("");

	// Handle action results
	useTask$(({ track }) => {
		track(() => createGroup.value);
		track(() => createProduct.value);

		if (createGroup.value?.success) {
			successMessage.value = t(
				"events.admin.products.inventoryGroupCreatedSuccessfully",
			);
			showGroupForm.value = false;
			setTimeout(() => {
				successMessage.value = "";
			}, 3000);
		} else if (createGroup.value?.failed) {
			errorMessage.value =
				createGroup.value.message ||
				t("events.admin.products.failedToCreateInventoryGroup");
			setTimeout(() => {
				errorMessage.value = "";
			}, 5000);
		}

		if (createProduct.value?.success) {
			successMessage.value = t(
				"events.admin.products.productCreatedSuccessfully",
			);
			showProductForm.value = false;
			setTimeout(() => {
				successMessage.value = "";
			}, 3000);
		} else if (createProduct.value?.failed) {
			errorMessage.value =
				createProduct.value.message ||
				t("events.admin.products.failedToCreateProduct");
			setTimeout(() => {
				errorMessage.value = "";
			}, 5000);
		}
	});

	return (
		<div class="space-y-8">
			{/* Success/Error Messages */}
			{successMessage.value && (
				<div class="p-4 bg-green-100 border border-green-400 text-green-700 rounded-sm">
					{successMessage.value}
				</div>
			)}
			{errorMessage.value && (
				<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{errorMessage.value}
				</div>
			)}

			<div>
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-2xl font-bold">
						{t("events.admin.products.inventoryGroupsProducts")}
					</h2>
					<Button
						onClick$={() => {
							showGroupForm.value = !showGroupForm.value;
						}}
					>
						{showGroupForm.value
							? t("events.admin.products.cancel")
							: t("events.admin.products.newInventoryGroup")}
					</Button>
				</div>

				{showGroupForm.value && (
					<InventoryGroupForm
						action={createGroup}
						onCancel={$((): void => {
							showGroupForm.value = false;
						})}
					/>
				)}

				{data.groups.length === 0 && !showGroupForm.value && (
					<div class="p-8 text-center text-gray-500 border rounded-sm">
						<p class="mb-2">
							{t("events.admin.products.noInventoryGroupsYet")}
						</p>
						<p class="text-sm">
							{t("events.admin.products.createAnInventoryGroupTo")}
						</p>
					</div>
				)}

				{data.groups.map((group) => (
					<div key={group.id} class="mb-6 p-4 border rounded-sm bg-white">
						<div class="flex justify-between items-center mb-4">
							<div>
								<h3 class="text-lg font-bold">{group.name}</h3>
								<p class="text-sm text-gray-600">
									{t("events.admin.products.capacityNeedsTicket", {
										maxCapacity: group.maxCapacity,
									})}{" "}
									{group.needsTicket
										? t("events.admin.products.yes")
										: t("events.admin.products.no")}
								</p>
								{(group.salesStartDate || group.salesEndDate) && (
									<p class="text-sm text-gray-600 mt-1">
										{t("events.admin.products.sales")}{" "}
										{group.salesStartDate
											? formatDate(group.salesStartDate, "dateTime")
											: "—"}
										{group.salesEndDate
											? ` - ${formatDate(group.salesEndDate, "dateTime")}`
											: ""}
									</p>
								)}
							</div>
							<Button
								onClick$={() => {
									selectedGroupId.value = group.id;
									showProductForm.value = true;
								}}
							>
								{t("events.admin.products.addProduct")}
							</Button>
						</div>

						{group.products && group.products.length > 0 ? (
							<div class="space-y-2">
								<h4 class="font-semibold text-sm text-gray-700">
									{t("events.admin.products.products")}
								</h4>
								{group.products.map((product) => (
									<div
										key={product.id}
										class="p-3 bg-gray-50 rounded-sm flex gap-4"
									>
										{product.imageUrl && (
											<img
												width={64}
												height={64}
												src={product.imageUrl}
												alt={product.name}
												class="w-16 h-16 object-cover rounded-sm shrink-0"
											/>
										)}
										<div class="flex-1">
											<p class="font-medium">{product.name}</p>
											<p class="text-sm text-gray-600">
												{t("events.admin.products.sold", {
													price: formatCurrency(product.price, "EUR"),
													soldQuantity: product.soldQuantity,
													maxQuantity: product.maxQuantity || "∞",
												})}
											</p>
											{product.features && product.features.length > 0 && (
												<p class="text-xs text-gray-500 mt-1">
													{product.features.join(", ")}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						) : (
							<p class="text-sm text-gray-500 italic">
								{t("events.admin.products.noProductsYetAddOne")}
							</p>
						)}
					</div>
				))}
			</div>

			{showProductForm.value && (
				<ProductForm
					action={createProduct}
					inventoryGroups={data.groups.map((g) => ({
						id: g.id,
						name: g.name,
					}))}
					selectedGroupId={selectedGroupId.value}
					onCancel={$((): void => {
						showProductForm.value = false;
					})}
				/>
			)}
		</div>
	);
});
