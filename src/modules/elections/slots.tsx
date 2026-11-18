import { component$ } from "@qwik.dev/core";
import type { SlotComponents, SlotProps } from "~/contracts/slots";
import { ElectionHistory } from "~theme/routes/profile/ElectionHistory/ElectionHistory";
import { useElectionHistory } from "./useElectionHistory";

/** `profile.sections`: the viewer's own election applications (private). */
const OwnElectionHistory = component$<SlotProps["profile.sections"]>(() => {
	const groups = useElectionHistory();
	return <ElectionHistory groups={groups.value} />;
});

/** `userPage.sections`: the same, on `/users/<id>` when that is the viewer's own page. */
const UserPageElectionHistory = component$<SlotProps["userPage.sections"]>(
	({ userId }) => {
		const groups = useElectionHistory(userId);
		return <ElectionHistory groups={groups.value} />;
	},
);

/** The elections module's slot components (manifest `slots`; listed in the client-safe registry). */
export const electionsSlots: SlotComponents = {
	"profile.sections": OwnElectionHistory,
	"userPage.sections": UserPageElectionHistory,
};
