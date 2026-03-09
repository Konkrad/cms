import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { env } from "~/env";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { deriveProfilePicSmallKey } from "~/utils/images";
import { formatUser } from "~/utils/users";

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  // Build profile picture URLs from S3 keys if present
  let profilePictureUrl: string | null = null;
  let profilePictureSmallUrl: string | null = null;
  const user = userData as any;

  if (user.profilePicture) {
    const key = user.profilePicture.replace(/^\//, "");
    profilePictureUrl = env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    const smallKey = deriveProfilePicSmallKey(user.profilePicture).replace(/^\//, "");
    profilePictureSmallUrl = env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${smallKey}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${smallKey}`;
  }

  return {
    ...formatUser(userData, true),
    profilePictureUrl,
    profilePictureSmallUrl,
  };
});

export default component$(() => {
  const profile = useProfile();

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">My Profile</h1>
        <a href="/profile/edit">
          <Button variant="primary">Edit Profile</Button>
        </a>
      </div>

      <Card>
        <div class="space-y-6">
          {/* Profile Picture */}
          <div class="flex items-center gap-6">
            {profile.value.profilePictureUrl ? (
              <img
                src={profile.value.profilePictureUrl}
                alt={`${profile.value.displayName}'s profile picture`}
                width={120}
                height={120}
                class="w-[120px] h-[120px] rounded-full object-cover border-2 border-gray-200 shadow-sm"
              />
            ) : (
              <div class="w-[120px] h-[120px] rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                <svg
                  class="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
            )}
            <div>
              <h2 class="text-xl font-semibold">{profile.value.displayName}</h2>
              <p class="text-gray-500 text-sm capitalize">
                {profile.value.role.replace("_", " ")}
              </p>
            </div>
          </div>

          <hr class="border-gray-200" />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                First Name
              </label>
              <p class="text-lg">{profile.value.name}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Last Name
              </label>
              <p class="text-lg">{profile.value.familyName}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Email
              </label>
              <p class="text-lg">{profile.value.email}</p>
            </div>

            {profile.value.city && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  City
                </label>
                <p class="text-lg">{profile.value.city}</p>
              </div>
            )}

            {profile.value.country && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Country
                </label>
                <p class="text-lg">{profile.value.country}</p>
              </div>
            )}

            {profile.value.yearOfBirth && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Year of Birth
                </label>
                <p class="text-lg">{profile.value.yearOfBirth}</p>
              </div>
            )}

            {profile.value.sex && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Gender
                </label>
                <p class="text-lg">{profile.value.sex}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
});
