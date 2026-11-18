import type { ScopeListItem } from "~/contracts/scopes";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/core/media/images";
import { scopeUrl } from "~/core/router/scope-path";
import type { Scope } from "~/core/scopes/schema/scopes";

/** A scope as a listing card (public fields only). */
export function toScopeListItem(
	scope: Scope & { memberCount: number },
): ScopeListItem {
	return {
		id: scope.id,
		name: scope.name,
		kind: scope.kind,
		url: scopeUrl(scope.path),
		imageUrl: scope.image1
			? publicImageUrlFromKey(deriveThumbnailKey(scope.image1))
			: null,
		memberCount: scope.memberCount,
	};
}
