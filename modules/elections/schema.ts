import { defineModuleSchema } from "~/core-api/db-schema";
import { electionApplications } from "./election-applications";
import { electionCycles } from "./election-cycles";
import { electionPositions } from "./election-positions";

export * from "./election-applications";
export * from "./election-cycles";
export * from "./election-positions";

export default defineModuleSchema({
	tables: { electionCycles, electionPositions, electionApplications },
	relations: (r) => ({
		electionCycles: {
			positions: r.many.electionPositions({
				from: r.electionCycles.id,
				to: r.electionPositions.cycleId,
			}),
		},
		electionPositions: {
			cycle: r.one.electionCycles({
				from: r.electionPositions.cycleId,
				to: r.electionCycles.id,
				optional: false,
			}),
			applications: r.many.electionApplications({
				from: r.electionPositions.id,
				to: r.electionApplications.positionId,
			}),
		},
		electionApplications: {
			position: r.one.electionPositions({
				from: r.electionApplications.positionId,
				to: r.electionPositions.id,
				optional: false,
			}),
			cycle: r.one.electionCycles({
				from: r.electionApplications.cycleId,
				to: r.electionCycles.id,
				optional: false,
			}),
			user: r.one.users({
				from: r.electionApplications.userId,
				to: r.users.id,
				optional: false,
			}),
		},
		users: {
			electionApplications: r.many.electionApplications({
				from: r.users.id,
				to: r.electionApplications.userId,
			}),
		},
	}),
});
