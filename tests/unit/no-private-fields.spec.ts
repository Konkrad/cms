import { describe, expect, it } from "vitest";
import {
	assertNoPrivateFields,
	findPrivateFields,
} from "~/core/shared/no-private-fields";

describe("findPrivateFields", () => {
	it("returns nothing for a public payload", () => {
		expect(
			findPrivateFields({
				id: "1",
				title: "Event",
				user: { id: "u", name: "Ada", familyName: "L" },
				profilePictureSmall: "public/profile-pictures/x-thumb.webp",
				tags: [{ id: "t", label: "x" }],
			}),
		).toEqual([]);
	});

	it("finds forbidden keys deep in objects and arrays, with their paths", () => {
		expect(
			findPrivateFields({
				items: [{ user: { id: "u" } }, { user: { id: "v", email: "a@b.c" } }],
				owner: { profile: { loginId: "l", consent: {} } },
			}),
		).toEqual([
			"items[1].user.email",
			"owner.profile.loginId",
			"owner.profile.consent",
		]);
	});

	it("flags a forbidden key even when its value is null", () => {
		expect(findPrivateFields({ user: { phone: null } })).toEqual([
			"user.phone",
		]);
	});

	it("flags every stripe* key and the private profile picture key", () => {
		expect(
			findPrivateFields({
				stripeSessionId: "cs_1",
				payment: { stripePaymentId: "pi_1", StripeCustomer: "c" },
				profilePicture: "private/profile-pictures/x.webp",
			}),
		).toEqual([
			"stripeSessionId",
			"payment.stripePaymentId",
			"payment.StripeCustomer",
			"profilePicture",
		]);
	});

	it("covers user, login, session and ticket secrets", () => {
		const keys = [
			"yearOfBirth",
			"sex",
			"latitude",
			"longitude",
			"phone",
			"token",
			"sessionToken",
			"otpHash",
			"magicHash",
			"qrCodeUuid",
		];
		const payload = Object.fromEntries(keys.map((k) => [k, "x"]));
		expect(findPrivateFields(payload)).toEqual(keys);
	});

	it("skips allowed keys only", () => {
		expect(
			findPrivateFields(
				{ users: [{ email: "a@b.c", phone: "123", sex: "f" }] },
				["email", "phone"],
			),
		).toEqual(["users[0].sex"]);
	});

	it("scans Map and Set values and survives cycles", () => {
		const cyclic: Record<string, unknown> = { id: "x" };
		cyclic.self = cyclic;
		expect(
			findPrivateFields({
				cyclic,
				map: new Map([["a", { email: "x" }]]),
				set: new Set([{ loginId: "l" }]),
				when: new Date(),
			}),
		).toEqual(["map.a.email", "set[0].loginId"]);
	});

	it("ignores primitives and nullish values", () => {
		expect(findPrivateFields(null)).toEqual([]);
		expect(findPrivateFields(undefined)).toEqual([]);
		expect(findPrivateFields("email")).toEqual([]);
		expect(findPrivateFields(42)).toEqual([]);
	});
});

describe("assertNoPrivateFields", () => {
	it("returns the value unchanged when it is clean", () => {
		const value = { id: "1", user: { name: "Ada" } };
		expect(assertNoPrivateFields(value)).toBe(value);
	});

	it("throws outside production, naming the offending paths", () => {
		expect(() =>
			assertNoPrivateFields({ organizer: { email: "a@b.c" } }),
		).toThrow(/organizer\.email/);
	});

	it("passes when the field is explicitly allowed", () => {
		const value = { attendees: [{ email: "a@b.c" }] };
		expect(assertNoPrivateFields(value, { allow: ["email"] })).toBe(value);
	});
});
