import { t } from "~/core";
import { inventoryGroupsService } from "./inventory-groups";
import { productsService } from "./products";

interface CheckoutItem {
	productId: string;
	quantity: number;
}

export const checkoutService = {
	async validateInventory(
		eventId: string,
		items: CheckoutItem[],
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		// Get all products and inventory groups
		const productIds = items.map((item) => item.productId);
		const products = await Promise.all(
			productIds.map((id) => productsService.getById(id)),
		);

		// Validate each product exists
		for (let i = 0; i < items.length; i++) {
			const product = products[i];
			if (!product) {
				errors.push(`Product ${items[i].productId} not found`);
				continue;
			}

			// Check if product belongs to the event
			if (product.eventId !== eventId) {
				errors.push(
					t("events.service.productDoesNotBelongTo", { name: product.name }),
				);
				continue;
			}

			// Check max quantity per purchase
			if (product.maxQuantity > 0 && items[i].quantity > product.maxQuantity) {
				errors.push(
					t("events.service.productAllowsMaximumPerPurchase", {
						name: product.name,
						maxQuantity: product.maxQuantity,
					}),
				);
			}

			// Check remaining product quantity against sold stock
			if (product.maxQuantity > 0) {
				const remainingProductQuantity =
					product.maxQuantity - (product.soldQuantity || 0);
				if (items[i].quantity > remainingProductQuantity) {
					errors.push(
						t("events.service.productHasOnlyRemaining", {
							name: product.name,
							value: Math.max(0, remainingProductQuantity),
						}),
					);
				}
			}
		}

		// Group items by inventory group
		const groupedByInventory = new Map<
			string,
			{ productIds: string[]; totalQty: number }
		>();

		for (let i = 0; i < items.length; i++) {
			const product = products[i];
			if (!product) continue;

			const inventoryGroupId = product.inventoryGroupId;
			const existing = groupedByInventory.get(inventoryGroupId) || {
				productIds: [],
				totalQty: 0,
			};
			existing.productIds.push(product.id);
			existing.totalQty += items[i].quantity;
			groupedByInventory.set(inventoryGroupId, existing);
		}

		// Validate inventory capacity for each group
		for (const [inventoryGroupId, data] of groupedByInventory.entries()) {
			const inventoryGroup =
				await inventoryGroupsService.getById(inventoryGroupId);
			if (!inventoryGroup) {
				errors.push(t("events.service.inventoryGroupNotFound"));
				continue;
			}

			// Check remaining capacity
			const validation = await inventoryGroupsService.validatePurchase(
				inventoryGroupId,
				data.totalQty,
			);
			if (!validation.allowed) {
				errors.push(
					validation.reason ||
						t("events.service.notEnoughCapacityInOnly", {
							name: inventoryGroup.name,
							remainingCapacity: validation.remainingCapacity,
						}),
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	},
};
