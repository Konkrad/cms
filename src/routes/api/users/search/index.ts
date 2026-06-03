import type { RequestHandler } from "@qwik.dev/router";
import { eq, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import { logins } from "~/db/schemas/logins";
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

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      familyName: users.familyName,
      email: logins.email,
      profilePicture: users.profilePicture,
    })
    .from(users)
    .leftJoin(logins, eq(logins.id, users.loginId))
    .where(sql`lower(${users.name} || ' ' || ${users.familyName}) like ${likePattern}`)
    .limit(8);

  const payload = rows.map((row) => {
    const displayName = [row.name, row.familyName].filter(Boolean).join(" ").trim();
    const avatarUrl = row.profilePicture
      ? publicImageUrlFromKey(deriveThumbnailKey(row.profilePicture)) ||
        publicImageUrlFromKey(row.profilePicture)
      : null;

    return {
      id: row.id,
      displayName,
      email: row.email || "",
      avatarUrl,
    };
  });

  json(200, { users: payload });
};
