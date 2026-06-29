import { component$ } from "@qwik.dev/core";
import { UserProfile } from "~theme/routes/profile/UserProfile/UserProfile";
import type { PublicProfileViewData } from "~/contracts/users";

/** Themed view for another user's public profile (`/users/[userId]`). */
export const PublicProfileView = component$<{ data: PublicProfileViewData }>(({ data }) => {
  if (!data) {
    return (
      <div class="container mx-auto px-4 py-16 max-w-4xl text-center">
        <h1 class="text-2xl font-bold text-gray-800">Profile not found</h1>
        <p class="text-gray-500 mt-2">This profile does not exist.</p>
      </div>
    );
  }

  return <UserProfile {...data} />;
});
