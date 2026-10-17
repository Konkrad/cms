import { $, component$, useSignal } from "@qwik.dev/core";
import { Link, routeAction$, useLocation, z, zod$ } from "@qwik.dev/router";
import { deleteS3Objects, deriveThumbnailKey } from "~/core";
import { Button, Card, formatDate, ImageUploader, t } from "~/core/ui";
import { photosService } from "../services/photos";
import { requireAdminEvent } from "./event-guards";
import type { AdminPhotosData } from "./photos-data";

export const useCreatePhoto = routeAction$(
	async (data, requestEvent) => {
		const { user } = await requireAdminEvent(requestEvent);
		const { params, fail } = requestEvent;

		// The file must live under this event's own gallery prefix, never another event's.
		if (
			!data.filePath.startsWith(`private/events/${params.id}/`) ||
			data.filePath.includes("..")
		) {
			return fail(400, { message: t("events.admin.photos.invalidPhotoPath") });
		}

		// Create photo record
		const photo = await photosService.create({
			eventId: params.id,
			filePath: data.filePath,
			uploadedBy: user.id,
		});

		return {
			success: true,
			photo,
		};
	},
	zod$({
		filePath: z.string().startsWith("private/events/").endsWith(".webp"),
	}),
);

export const useDeletePhoto = routeAction$(
	async (data, requestEvent) => {
		await requireAdminEvent(requestEvent);
		const { params, fail } = requestEvent;

		const photo = await photosService.getById(data.photoId);
		if (!photo || photo.eventId !== params.id) {
			return fail(404, { message: t("events.admin.photos.photoNotFound") });
		}

		// Delete from S3 (main + thumbnail)
		await deleteS3Objects([photo.filePath, deriveThumbnailKey(photo.filePath)]);

		// Delete from DB
		await photosService.delete(photo.id);

		return { success: true };
	},
	zod$({
		photoId: z.string().min(1),
	}),
);

type Props = { data: AdminPhotosData };

export const AdminEventPhotos = component$<Props>(({ data }) => {
	const { event, photos } = data;
	const location = useLocation();
	const parts = location.url.pathname.split("/");
	const scopeSegment = parts[2] || "root";
	const backUrl = `/admin/${scopeSegment}/events/${event.id}`;
	const createPhotoAction = useCreatePhoto();
	const deletePhotoAction = useDeletePhoto();
	const uploadSuccess = useSignal<string | null>(null);
	const uploadError = useSignal<string | null>(null);

	return (
		<div class="container mx-auto px-4 py-8 max-w-6xl">
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-gray-900">
					{t("events.admin.photos.managePhotos", { title: event.title })}
				</h1>
				<p class="mt-2 text-gray-600">
					{t("events.admin.photos.uploadPhotosThatWillBe")}
				</p>
			</div>

			{/* Upload Section */}
			<Card class="mb-8">
				<ImageUploader
					path={`private/events/${event.id}/photos`}
					pipeline="gallery"
					autoUpload
					aspectRatio="4/3"
					onFileUploaded$={$(async (response: { filePath?: string }) => {
						if (!response.filePath) {
							uploadError.value = t(
								"events.admin.photos.uploadFailedNoFilePath",
							);
							return;
						}

						const result = await createPhotoAction.submit({
							filePath: response.filePath,
						});

						if (result.value?.success) {
							uploadSuccess.value = t(
								"events.admin.photos.photoUploadedSuccessfully",
							);
							uploadError.value = null;
							window.location.reload();
						} else {
							const errorMsg =
								result.value?.message ||
								(result.value?.fieldErrors
									? JSON.stringify(result.value.fieldErrors)
									: t("events.admin.photos.failedToRegisterPhoto"));
							uploadError.value = errorMsg;
							uploadSuccess.value = null;
						}
					})}
				/>

				{uploadSuccess.value && (
					<div class="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-sm">
						{uploadSuccess.value}
					</div>
				)}

				{uploadError.value && (
					<div class="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
						{uploadError.value}
					</div>
				)}

				{createPhotoAction.value?.fieldErrors && (
					<div class="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
						<strong>{t("events.admin.photos.validationErrors")}</strong>
						<pre class="mt-2 text-sm">
							{JSON.stringify(createPhotoAction.value.fieldErrors, null, 2)}
						</pre>
					</div>
				)}
			</Card>

			{/* Photos List */}
			<Card>
				<h2 class="text-xl font-bold text-gray-900 mb-4">
					{t("events.admin.photos.uploadedPhotos", { count: photos.length })}
				</h2>

				{photos.length === 0 ? (
					<div class="text-center py-8 text-gray-500">
						<p>{t("events.admin.photos.noPhotosUploadedYetUse")}</p>
					</div>
				) : (
					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{photos.map((photo) => (
							<div
								key={photo.id}
								class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
							>
								<img
									width={64}
									height={64}
									src={photo.thumbnailUrl || photo.fullUrl}
									alt={photo.filePath.split("/").pop()}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
								<div class="absolute inset-0 flex flex-col justify-between bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
									<div class="flex justify-end p-2">
										<Button
											variant="danger"
											size="sm"
											onClick$={async () => {
												if (!confirm(t("events.admin.photos.deleteThisPhoto")))
													return;
												await deletePhotoAction.submit({ photoId: photo.id });
												window.location.reload();
											}}
										>
											{t("events.admin.photos.delete")}
										</Button>
									</div>
									<div class="p-2">
										<p
											class="text-xs text-white truncate"
											title={photo.filePath}
										>
											{photo.filePath.split("/").pop()}
										</p>
										<p class="text-xs text-white/80">
											{formatDate(photo.uploadedAt)}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			<div class="mt-6">
				<Link
					href={backUrl}
					class="text-blue-600 hover:text-blue-700 font-medium"
				>
					{t("events.admin.photos.backToEventDashboard")}
				</Link>
			</div>
		</div>
	);
});
