import { defineModuleSchema } from "~/core/schema";
import { qualificationTokens } from "./qualification-tokens";
import { qualificationTypes } from "./qualification-types";
import { userQualifications } from "./user-qualifications";

export * from "./qualification-tokens";
export * from "./qualification-types";
export * from "./user-qualifications";

export default defineModuleSchema({
	tables: { qualificationTypes, qualificationTokens, userQualifications },
	relations: (r) => ({
		qualificationTypes: {
			qualifications: r.many.userQualifications({
				from: r.qualificationTypes.id,
				to: r.userQualifications.typeId,
			}),
			tokens: r.many.qualificationTokens({
				from: r.qualificationTypes.id,
				to: r.qualificationTokens.typeId,
			}),
		},
		qualificationTokens: {
			type: r.one.qualificationTypes({
				from: r.qualificationTokens.typeId,
				to: r.qualificationTypes.id,
				optional: false,
			}),
			creator: r.one.users({
				from: r.qualificationTokens.createdBy,
				to: r.users.id,
				optional: false,
			}),
		},
		userQualifications: {
			user: r.one.users({
				from: r.userQualifications.userId,
				to: r.users.id,
				optional: false,
			}),
			verifier: r.one.users({
				from: r.userQualifications.verifiedBy,
				to: r.users.id,
			}),
			type: r.one.qualificationTypes({
				from: r.userQualifications.typeId,
				to: r.qualificationTypes.id,
				optional: false,
			}),
		},
		users: {
			qualifications: r.many.userQualifications({
				from: r.users.id,
				to: r.userQualifications.userId,
			}),
		},
	}),
});
