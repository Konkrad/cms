/**
 * Demo data of the jobs module (manifest `seed`, run by scripts/seed.ts after core while the
 * module is active; no e2e fixtures: specs create their own jobs). Loaded lazily.
 */
import { type SeedContext, seedPeople } from "~/core";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function daysFromNow(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d.toISOString();
}

export async function seedJobs(ctx: SeedContext): Promise<void> {
	if (ctx.mode !== "demo") return;
	const { db, schema } = ctx;
	const rootScope = { id: ctx.rootScopeId };
	const { resolveAuthor } = seedPeople(ctx);

	// ─── 17. Jobs ───────────────────────────────────────────────────────────────

	const jobDefs: Array<{
		title: string;
		body: string;
		locationType: "on-site" | "remote-eu" | "remote-country";
		city?: string;
		country?: string;
		link?: string;
		posterRelation?:
			| "hiring"
			| "founder"
			| "direct-team"
			| "works-there"
			| "other";
		expiresAtOffsetDays: number;
		status: "pending" | "approved";
		authorIdx: number;
	}> = [
		{
			title: "Senior Full-Stack Engineer",
			body: `<h2>About the role</h2><p>We are looking for a Senior Full-Stack Engineer to join our product team. You will own features end-to-end — from database design through to the user interface.</p><h2>What you'll do</h2><ul><li>Design and build scalable backend APIs with Node.js</li><li>Develop responsive frontend components in React or similar</li><li>Collaborate with product and design in a small, fast-moving team</li></ul><h2>What we're looking for</h2><ul><li>5+ years of professional software development experience</li><li>Solid TypeScript and SQL skills</li><li>Strong communication and ownership mindset</li></ul>`,
			locationType: "on-site",
			city: "Demo City",
			country: "Exampleland",
			link: "https://example.com/jobs/senior-fullstack",
			posterRelation: "hiring",
			expiresAtOffsetDays: 25,
			status: "approved",
			authorIdx: 0,
		},
		{
			title: "Product Designer (Remote, EU)",
			body: `<h2>The opportunity</h2><p>We're hiring a Product Designer to help shape the future of our platform. You'll work closely with engineering and product to craft clear, useful, and beautiful interfaces.</p><h2>Responsibilities</h2><ul><li>Own the design process from discovery through delivery</li><li>Conduct user research and usability testing</li><li>Maintain and evolve our design system</li></ul><h2>Requirements</h2><ul><li>3+ years of product design experience</li><li>Proficiency with Figma</li><li>Experience in an agile environment</li></ul>`,
			locationType: "remote-eu",
			link: "https://example.com/jobs/product-designer",
			posterRelation: "hiring",
			expiresAtOffsetDays: 20,
			status: "approved",
			authorIdx: 2,
		},
		{
			title: "Data Analyst — Remote",
			body: `<h2>What you'll be doing</h2><p>Join our analytics team and help us turn data into decisions. You'll build dashboards, run analyses, and work with stakeholders across the business.</p><h2>Skills & experience</h2><ul><li>Strong SQL and Python skills</li><li>Experience with BI tools such as Metabase or Looker</li><li>Comfortable presenting findings to non-technical audiences</li></ul>`,
			locationType: "remote-country",
			country: "Exampleland",
			posterRelation: "works-there",
			expiresAtOffsetDays: 18,
			status: "approved",
			authorIdx: 4,
		},
		{
			title: "Community Manager",
			body: `<h2>About this role</h2><p>We are growing our local presence and are looking for a Community Manager to cultivate and grow the member base. You'll organise events, onboard new members, and be the face of the community.</p><h2>What we need</h2><ul><li>Excellent interpersonal and organisational skills</li><li>Experience planning and running events</li><li>Strong communication skills</li></ul>`,
			locationType: "on-site",
			city: "Southville",
			country: "Exampleland",
			posterRelation: "founder",
			expiresAtOffsetDays: 28,
			status: "approved",
			authorIdx: 7,
		},
		{
			title: "Backend Engineer — Pending Review",
			body: `<h2>The role</h2><p>We are hiring a Backend Engineer to work on our core platform API.</p><h2>Requirements</h2><ul><li>3+ years backend experience (Go, Node.js, or Python)</li><li>Experience with REST and/or GraphQL APIs</li><li>Familiarity with cloud infrastructure (AWS, GCP)</li></ul>`,
			locationType: "on-site",
			city: "Midtown",
			country: "Exampleland",
			link: "https://example.com/jobs/backend-engineer",
			posterRelation: "hiring",
			expiresAtOffsetDays: 30,
			status: "pending",
			authorIdx: 1,
		},
		{
			title: "Marketing Lead — Pending Review",
			body: `<h2>Overview</h2><p>We are looking for a Marketing Lead to own our growth channels and brand strategy.</p><h2>What you'll do</h2><ul><li>Define and execute the marketing roadmap</li><li>Manage social media, email, and paid channels</li><li>Measure and report on campaign performance</li></ul>`,
			locationType: "remote-eu",
			posterRelation: "direct-team",
			expiresAtOffsetDays: 14,
			status: "pending",
			authorIdx: 3,
		},
		{
			title: "Expired Role (Seed)",
			body: "<p>This job listing has already expired and should not appear in the public job board.</p>",
			locationType: "on-site",
			city: "Portstown",
			country: "Exampleland",
			expiresAtOffsetDays: -5,
			status: "approved",
			authorIdx: 6,
		},
	];

	for (const j of jobDefs) {
		const id = uuid();
		db.insert(schema.jobs)
			.values({
				id,
				scopeId: rootScope.id,
				title: j.title,
				body: j.body,
				editorState: null,
				locationType: j.locationType,
				city: j.city ?? null,
				country: j.country ?? null,
				link: j.link ?? null,
				posterRelation: j.posterRelation ?? null,
				expiresAt: daysFromNow(j.expiresAtOffsetDays),
				status: j.status,
				suggestedBy: resolveAuthor(j.authorIdx),
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
		// Pending listings wait in the root's Reviews queue, as if submitted through /jobs/new.
		if (j.status === "pending")
			db.insert(schema.reviews)
				.values({
					id: uuid(),
					ref: `jobs:job:${id}`,
					scopeId: rootScope.id,
					status: "in_review",
					submittedBy: resolveAuthor(j.authorIdx),
					createdAt: now(),
				})
				.run();
	}
	console.log(
		`  jobs seeded (${jobDefs.length}: ${jobDefs.filter((j) => j.status === "approved").length} approved, ${jobDefs.filter((j) => j.status === "pending").length} pending, 1 expired)`,
	);

	// Links to the job board in both menus.
	for (const [menuName, position] of [
		["main", 4],
		["footer", 5],
	] as const)
		db.insert(schema.menuItems)
			.values({
				id: uuid(),
				menuName,
				title: "Jobs",
				url: "/jobs",
				pageId: null,
				position,
				status: "visible",
				target: "_self",
				createdAt: now(),
				updatedAt: now(),
			})
			.run();
}
