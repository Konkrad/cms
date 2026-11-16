import { component$, type QRL } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import { useScopeMembers } from "~/core/scopes/useScopeMembers";
import { ParticipantsModal } from "~theme/shared/ParticipantsModal";

/** All members of the scope home page's scope (and the scopes below), 20 at a time. */
export const ScopeMembersModal = component$<{
	scopeName: string;
	onClose$: QRL<() => void>;
}>(({ scopeName, onClose$ }) => {
	const { members, hasMore, isLoading, isLoadingMore, error, loadMore } =
		useScopeMembers();

	return (
		<ParticipantsModal
			title={t("theme.scope.membersModalTitle", { name: scopeName })}
			emptyText={t("theme.scope.noMembersYet")}
			participants={members.value}
			isLoading={isLoading.value}
			error={error.value}
			hasMore={hasMore.value}
			isLoadingMore={isLoadingMore.value}
			onLoadMore$={loadMore}
			onClose$={onClose$}
		/>
	);
});
