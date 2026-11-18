import type { WorkflowFormSeed } from "~/core";

/** The default `events.proposal` form (spec 5.2): what a chapter submits with a public event. */
export const eventProposalFormSeed = (): WorkflowFormSeed => ({
	purpose: "events.proposal",
	title: "Event proposal",
	slug: "event-proposal",
	description: "Tell the coordinators about the event you plan.",
	schema: {
		pages: [
			{
				name: "proposal",
				elements: [
					{
						type: "comment",
						name: "purpose",
						title: "What is the event for?",
						isRequired: true,
					},
					{
						type: "text",
						name: "expected_attendance",
						title: "Expected attendance",
						inputType: "number",
						isRequired: true,
					},
					{
						type: "boolean",
						name: "funding_needed",
						title: "Do you need funding?",
						isRequired: true,
					},
					{
						type: "text",
						name: "budget",
						title: "Budget (EUR)",
						inputType: "number",
						visibleIf: "{funding_needed} = true",
					},
				],
			},
		],
	},
});

/** The default `events.debrief` form (spec 5.2): asked from the organiser after the event. */
export const eventDebriefFormSeed = (): WorkflowFormSeed => ({
	purpose: "events.debrief",
	title: "Event debrief",
	slug: "event-debrief",
	description: "How did the event go?",
	schema: {
		pages: [
			{
				name: "debrief",
				elements: [
					{
						type: "text",
						name: "attendance",
						title: "How many people came?",
						inputType: "number",
						isRequired: true,
					},
					{
						type: "rating",
						name: "rating",
						title: "How did it go overall?",
						rateMin: 1,
						rateMax: 5,
						isRequired: true,
					},
					{ type: "comment", name: "went_well", title: "What went well?" },
					{
						type: "comment",
						name: "improve",
						title: "What would you do differently?",
					},
				],
			},
		],
	},
});
