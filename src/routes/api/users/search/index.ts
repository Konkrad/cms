import type { RequestHandler } from "@qwik.dev/router";
import { getServerSession } from "~/core/auth/server-auth";
import { usersService } from "~/core/users/users.service";

export const onGet: RequestHandler = async (event) => {
	const { url, json } = event;
	const session = await getServerSession(event);
	if (!session?.id) {
		json(401, { users: [] });
		return;
	}

	const query = (url.searchParams.get("q") || "").trim().toLowerCase();
	if (query.length < 2) {
		json(200, { users: [] });
		return;
	}

	// Public fields only (see usersService.searchPublic): the participant's real email
	// is resolved server-side from `id` at checkout time.
	const rows = await usersService.searchPublic(query, 8);
	const payload = rows.map((row) => ({
		id: row.id,
		displayName: [row.name, row.familyName].filter(Boolean).join(" ").trim(),
		avatarUrl: row.profilePictureSmallUrl,
	}));

	json(200, { users: payload });
};
