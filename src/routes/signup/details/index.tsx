import { component$ } from "@builder.io/qwik";
import {
	Form,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@builder.io/qwik-city";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { db } from "~/db/connection";
import { sessions, users } from "~/db/schema";
import { requirePendingLogin } from "~/utils/server-auth";

export const usePending = routeLoader$(async (event) => {
	// Ensure there's a pending (verified) session referencing a login row
	const pending = await requirePendingLogin(event);
	return { email: pending.login?.email ?? null };
});

export const useComplete = routeAction$(
	async (data, event) => {
		// Ensure there's a pending session (verified email/OTP but no user yet)
		const pending = await requirePendingLogin(event);
		if (!pending) {
			return { success: false, error: "No pending signup session" };
		}

		// Create user with all required fields
		const newUserId = crypto.randomUUID();

		try {
			await db.insert(users).values({
				id: newUserId,
				name: data.name,
				familyName: data.family_name,
				displayName: data.display_name,
				city: data.city,
				country: data.country,
				longitude: data.longitude,
				latitude: data.latitude,
				yearOfBirth: data.year_of_birth,
				sex: data.sex,
				role: "user",
				loginId: pending.login.id,
			} as any);

			// Update session: associate the session with the newly created user and clear loginId
			const token = event.cookie.get("session")?.value;
			if (token) {
				await db
					.update(sessions)
					.set({ userId: newUserId, loginId: null })
					.where(eq(sessions.token, token));
			}

			// Redirect to profile page
			throw event.redirect(302, "/profile");
		} catch (err: any) {
			console.error("[signup/details] failed to complete signup", err);
			return { success: false, error: err?.message || "Failed to create user" };
		}
	},
	zod$({
		name: z.string().min(1, "Name is required"),
		family_name: z.string().min(1, "Family name is required"),
		display_name: z.string().min(1, "Display name is required"),
		city: z.string().min(1, "City is required"),
		country: z.string().min(1, "Country is required"),
		latitude: z
			.string()
			.regex(/^-?\d+(?:\.\d+)?$/, "Invalid latitude")
			.min(1, "Latitude is required"),
		longitude: z
			.string()
			.regex(/^-?\d+(?:\.\d+)?$/, "Invalid longitude")
			.min(1, "Longitude is required"),
		year_of_birth: z.coerce
			.number()
			.min(1900, "Enter a valid year")
			.max(new Date().getFullYear() - 13, "You must be at least 13 years old"),
		sex: z.enum(["male", "female", "other", "prefer_not_to_say"]),
	}),
);

export default component$(() => {
	const pending = usePending();
	const action = useComplete();

	return (
		<div class="container mx-auto px-4 py-8 max-w-2xl">
			<Card>
				<h1 class="text-3xl font-bold mb-6 text-center">
					Complete Your Profile
				</h1>

				<p class="mb-4">
					We sent a sign-in email to <strong>{pending.value.email}</strong>.
					Please complete your profile below (all fields are required).
				</p>

				{action.value?.error && (
					<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
						{action.value.error}
					</div>
				)}

				<Form action={action} class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Input label="First Name" name="name" type="text" required />
						<Input label="Last Name" name="family_name" type="text" required />
						<Input
							label="Display Name"
							name="display_name"
							type="text"
							required
							class="md:col-span-2"
						/>

						<Input label="City" name="city" type="text" required />
						<Input label="Country" name="country" type="text" required />

						<Input label="Latitude" name="latitude" type="text" required />
						<Input label="Longitude" name="longitude" type="text" required />

						<Input
							label="Year of Birth"
							name="year_of_birth"
							type="number"
							required
						/>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">
								Gender
							</label>
							<select
								name="sex"
								required
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">Select gender</option>
								<option value="male">Male</option>
								<option value="female">Female</option>
								<option value="other">Other</option>
								<option value="prefer_not_to_say">Prefer not to say</option>
							</select>
						</div>
					</div>

					<div class="flex gap-4 pt-4">
						<Button type="submit" variant="primary">
							Create Account
						</Button>
					</div>
				</Form>
			</Card>
		</div>
	);
});
