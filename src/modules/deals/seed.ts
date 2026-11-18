/**
 * Demo data of the deals module (manifest `seed`, run by scripts/seed.ts after core while the
 * module is active; no e2e fixtures: specs create their own deals). Loaded lazily.
 */
import type { SeedContext } from "~/core";
import type { DealStep } from "./schema";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function daysFromNow(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d.toISOString();
}

export async function seedDeals(ctx: SeedContext): Promise<void> {
	if (ctx.mode !== "demo") return;
	const { db, schema } = ctx;
	const rootScope = { id: ctx.rootScopeId };

	// ─── 16. Deals ───────────────────────────────────────────────────────────────

	async function uploadDealLogo(
		slug: string,
		bgColor: string,
		letter: string,
	): Promise<string | null> {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
	  <rect width="200" height="200" fill="${bgColor}"/>
	  <text x="100" y="115" text-anchor="middle" dominant-baseline="middle"
	    font-family="system-ui, -apple-system, sans-serif"
	    font-size="96" font-weight="700" fill="white">${letter}</text>
	</svg>`;
		const key = `public/deals/logos/seed-${slug}.svg`;
		const uploaded = await ctx.uploadPublicObject(
			key,
			Buffer.from(svg, "utf8"),
			"image/svg+xml",
		);
		if (!uploaded)
			console.warn(`  could not upload deal logo for ${slug}, skipping`);
		return uploaded;
	}

	const dealDefs: Array<{
		slug: string;
		logoColor: string;
		logoLetter: string;
		name: string;
		description: string;
		validUntilOffsetDays: number | null;
		steps: DealStep[];
	}> = [
		{
			slug: "cafe",
			logoColor: "#0d9488",
			logoLetter: "C",
			name: "10% Off at Partner Café",
			description: "Enjoy an exclusive 10% discount at our partner café chain.",
			validUntilOffsetDays: 90,
			steps: [
				{
					type: "text",
					title: "Who qualifies",
					text: "Available to all active community members.",
					requiresLogin: false,
				},
				{
					type: "link",
					title: "Find a Location",
					text: "Browse all café locations near you.",
					link: "https://example.com/cafe-locations",
					linkText: "Browse Locations",
					requiresLogin: false,
				},
				{
					type: "promo",
					title: "Your Promo Code",
					text: "Use this code at checkout or show it in-store.",
					promoCode: "COMMUNITY10",
					requiresLogin: true,
				},
			],
		},
		{
			slug: "gym",
			logoColor: "#ea580c",
			logoLetter: "G",
			name: "Free Month at FitSpace Gym",
			description:
				"Get your first month completely free at any FitSpace gym location.",
			validUntilOffsetDays: 60,
			steps: [
				{
					type: "text",
					title: "How it works",
					text: "Show your membership confirmation email at the front desk when signing up.",
					requiresLogin: false,
				},
				{
					type: "link",
					title: "Sign Up Online",
					text: "Start your free trial directly on the FitSpace website.",
					link: "https://example.com/fitspace-signup",
					linkText: "Start Free Trial",
					requiresLogin: true,
				},
				{
					type: "promo",
					title: "Referral Code",
					text: "Enter this code during online sign-up to activate the free month.",
					promoCode: "FITFREE2026",
					requiresLogin: true,
				},
			],
		},
		{
			slug: "cowork",
			logoColor: "#7c3aed",
			logoLetter: "W",
			name: "20% Off Co-Working Day Pass",
			description:
				"Work from one of our co-working partner spaces at a special member rate.",
			validUntilOffsetDays: null,
			steps: [
				{
					type: "text",
					title: "Valid Locations",
					text: "Valid at all SpaceHub co-working partner locations. Find a location near you on their website.",
					requiresLogin: false,
				},
				{
					type: "promo",
					title: "Day Pass Code",
					text: "Present this code at reception or enter it when booking online.",
					promoCode: "SPACE20",
					requiresLogin: true,
				},
			],
		},
		{
			slug: "expired",
			logoColor: "#6b7280",
			logoLetter: "X",
			name: "Expired Deal (Seed)",
			description:
				"This deal has already expired — used to test expiry filtering.",
			validUntilOffsetDays: -10,
			steps: [
				{
					type: "text",
					title: "Expired",
					text: "This deal is no longer active.",
					requiresLogin: false,
				},
			],
		},
	];

	for (const d of dealDefs) {
		const logoKey = await uploadDealLogo(d.slug, d.logoColor, d.logoLetter);
		const validUntil =
			d.validUntilOffsetDays !== null
				? daysFromNow(d.validUntilOffsetDays)
				: null;
		db.insert(schema.deals)
			.values({
				id: uuid(),
				scopeId: rootScope.id,
				name: d.name,
				description: d.description,
				logo: logoKey,
				validUntil,
				steps: d.steps,
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
	}
	console.log(`  deals seeded (${dealDefs.length})`);

	// The "Deals" page (the deals block), linked from the footer.
	{
		const pageId = uuid();
		db.insert(schema.pages)
			.values({
				id: pageId,
				scopeId: rootScope.id,
				slug: "deals",
				title: "Deals",
				content: [
					{
						id: uuid(),
						componentType: "TitleBlock",
						order: 0,
						data: { text: "Member Deals", level: "1", align: "center" },
					},
					{
						id: uuid(),
						componentType: "SpacerBlock",
						order: 1,
						data: { height: 20 },
					},
					{
						id: uuid(),
						componentType: "TextBlock",
						order: 2,
						data: {
							content:
								"<p>Exclusive discounts and offers for community members.</p>",
						},
					},
					{
						id: uuid(),
						componentType: "SpacerBlock",
						order: 3,
						data: { height: 20 },
					},
					{ id: uuid(), componentType: "DealsListBlock", order: 4, data: {} },
				],
				status: "published",
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		db.insert(schema.menuItems)
			.values({
				id: uuid(),
				menuName: "footer",
				title: "Deals",
				url: `ref:core:page:${pageId}`,
				pageId,
				position: 4,
				status: "visible",
				target: "_self",
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		console.log("  deals page and footer link seeded");
	}
}
