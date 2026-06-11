import type { RequestHandler } from "@qwik.dev/router";
import { sql } from "drizzle-orm";
import { db } from "~/db/connection";
import { users } from "~/db/schemas/users";
import { publicImageUrlFromKey, deriveThumbnailKey } from "~/utils/images";
import { getServerSession } from "~/utils/server-auth";

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

  const likePattern = `%${query}%`;

  // NOTE: deliberately does NOT return email. This endpoint is reachable by any
  // authenticated member (it backs the participant picker), so exposing emails
  // here would let any member harvest the whole directory. The participant's
  // real email is resolved server-side from `id` at checkout time.
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      familyName: users.familyName,
      profilePicture: users.profilePicture,
      profilePictureSmall: users.profilePictureSmall,
    })
    .from(users)
    .where(sql`lower(${users.name} || ' ' || ${users.familyName}) like ${likePattern}`)
    .limit(8);

  const payload = rows.map((row) => {
    const displayName = [row.name, row.familyName].filter(Boolean).join(" ").trim();
    const thumbKey = row.profilePictureSmall ?? (row.profilePicture ? deriveThumbnailKey(row.profilePicture) : null);
    const avatarUrl = publicImageUrlFromKey(thumbKey);

    return {
      id: row.id,
      displayName,
      avatarUrl,
    };
  });

  json(200, { users: payload });
};
