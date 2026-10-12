import { component$, type QRL, useSignal } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import {
	Button,
	ImageUploader,
	Input,
	Modal,
	publicImageUrlFromKey,
	t,
} from "~/core/ui";

interface ProductFormProps {
	action: any;
	inventoryGroups: Array<{ id: string; name: string }>;
	selectedGroupId?: string;
	onCancel: QRL<() => void>;
}

export const ProductForm = component$<ProductFormProps>(
	({ action, inventoryGroups, selectedGroupId, onCancel }) => {
		const uploadTrigger = useSignal(false);
		const currentImageKey = useSignal("");

		return (
			<Modal
				open={true}
				onClose$={onCancel}
				title={t("events.productForm.newProduct")}
				size="md"
			>
				<Form action={action}>
					<div class="space-y-4">
						<div>
							<label
								for="f-inventoryGroupId"
								class="block text-sm font-medium mb-1"
							>
								{t("events.productForm.inventoryGroup")}
							</label>
							<select
								id="f-inventoryGroupId"
								name="inventoryGroupId"
								class="w-full border rounded-sm px-3 py-2"
								required
							>
								{inventoryGroups.map((group) => (
									<option
										key={group.id}
										value={group.id}
										selected={group.id === selectedGroupId}
									>
										{group.name}
									</option>
								))}
							</select>
						</div>

						<Input
							name="name"
							label={t("events.productForm.productName")}
							required
						/>

						<Input
							name="price"
							label={t("events.productForm.priceEur")}
							type="number"
							step="0.01"
							min="0"
							required
						/>

						<Input
							name="maxQuantity"
							label={t("events.productForm.maxQuantityPerPurchase")}
							type="number"
							min="0"
							placeholder={t("events.productForm.n0Unlimited")}
							required
						/>

						<Input
							name="participantCapacity"
							label={t("events.productForm.participantCapacity")}
							type="number"
							min="1"
							value="1"
							placeholder={t(
								"events.productForm.numberOfParticipantsPerProduct",
							)}
							required
						/>

						<div>
							<label for="f-features" class="block text-sm font-medium mb-1">
								{t("events.productForm.featuresCommaSeparated")}
							</label>
							<textarea
								id="f-features"
								name="features"
								class="w-full border rounded-sm px-3 py-2"
								rows={3}
								placeholder={t("events.productForm.feature1Feature2Feature")}
							/>
						</div>

						<div>
							<p class="block text-sm font-medium mb-1">
								{t("events.productForm.productImage")}
							</p>
							<ImageUploader
								path="public/products"
								pipeline="standard"
								name="imageKey"
								triggerSignal={uploadTrigger}
								aspectRatio="1/1"
								crop
								cropAspectRatio="1/1"
								onFileUploaded$={(response: any) => {
									if (response.filePath) {
										currentImageKey.value = response.filePath;
									}
								}}
								currentUrl={
									currentImageKey.value
										? (publicImageUrlFromKey(currentImageKey.value) ??
											undefined)
										: undefined
								}
								currentValue={currentImageKey.value}
							/>
						</div>

						<div class="flex gap-2 pt-2">
							<Button
								type="submit"
								onClick$={() => {
									uploadTrigger.value = true;
								}}
							>
								{t("events.productForm.createProduct")}
							</Button>
							<Button type="button" onClick$={onCancel}>
								{t("events.productForm.cancel")}
							</Button>
						</div>
					</div>
				</Form>
			</Modal>
		);
	},
);
