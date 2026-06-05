import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";

interface Tag {
  id: string;
  label: string;
}

interface Community {
  name: string;
  slug: string;
}

interface EventEntry {
  id: string;
  title: string;
  startDate: string;
  city?: string | null;
  country?: string | null;
}

interface ElectionApp {
  id: string;
  status: string;
  position?: { title: string } | null;
}

interface ElectionGroup {
  title: string;
  year: number;
  apps: ElectionApp[];
}

interface FormEntry {
  id: string;
  title: string;
  submittedAt: string;
  path: string;
  responseEntries: { question: string; answer: string }[];
}

export interface UserProfileProps {
  name: string;
  familyName: string;
  role: string;
  city?: string | null;
  country?: string | null;
  profilePictureUrl?: string | null;
  tags: Tag[];
  communities: Community[];
  upcomingEvents: EventEntry[];
  pastEvents: EventEntry[];
  // Owner-only
  isOwner: boolean;
  email?: string | null;
  yearOfBirth?: number | null;
  sex?: string | null;
  // Extended sections (own profile only)
  electionGroups?: ElectionGroup[];
  submittedForms?: FormEntry[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const statusCls = (status: string) => {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
};

export const UserProfile = component$<UserProfileProps>((props) => {
  const {
    name,
    familyName,
    role,
    city,
    country,
    profilePictureUrl,
    tags,
    communities,
    upcomingEvents,
    pastEvents,
    isOwner,
    email,
    yearOfBirth,
    sex,
    electionGroups,
    submittedForms,
  } = props;

  const displayName = `${name} ${familyName}`.trim();
  const initials = `${name?.charAt(0) ?? ""}${familyName?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={`${displayName}'s profile picture`}
            width={100}
            height={100}
            class="w-[100px] h-[100px] rounded-full object-cover border-2 border-gray-200 shadow-xs shrink-0"
          />
        ) : (
          <div class="w-[100px] h-[100px] rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 shrink-0">
            <span class="text-gray-500 font-semibold text-2xl">{initials}</span>
          </div>
        )}
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{displayName}</h1>
          <span class="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
            {role.replace("_", " ")}
          </span>
          {(city || country) && (
            <p class="text-gray-500 text-sm mt-1">
              {[city, country].filter(Boolean).join(", ")}
            </p>
          )}
          {tags.length > 0 && (
            <div class="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Owner bar */}
      {isOwner && (
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-wrap">
          <Link
            href="/profile/edit"
            class="text-sm font-medium text-blue-700 hover:underline shrink-0"
          >
            Edit profile
          </Link>
          {email && (
            <span class="text-sm text-gray-700">
              <span class="font-medium">Email:</span> {email}
            </span>
          )}
          {yearOfBirth && (
            <span class="text-sm text-gray-700">
              <span class="font-medium">Year of birth:</span> {yearOfBirth}
            </span>
          )}
          {sex && (
            <span class="text-sm text-gray-700">
              <span class="font-medium">Gender:</span> {sex}
            </span>
          )}
        </div>
      )}

      {/* Communities */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Communities</h2>
        {communities.length === 0 ? (
          <p class="text-gray-500 text-sm">Not a member of any community yet.</p>
        ) : (
          <ul class="flex flex-wrap gap-2">
            {communities.map((c) => (
              <li key={c.slug}>
                <a
                  href={`/groups/${c.slug}`}
                  class="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-800"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming Events */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <p class="text-gray-500 text-sm">No upcoming events.</p>
        ) : (
          <ul class="space-y-2">
            {upcomingEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <p class="font-medium text-gray-900">{e.title}</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    {formatDate(e.startDate)}
                    {(e.city || e.country) && (
                      <> · {[e.city, e.country].filter(Boolean).join(", ")}</>
                    )}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past Events */}
      <section>
        <h2 class="text-xl font-semibold text-gray-800 mb-3">Past Events</h2>
        {pastEvents.length === 0 ? (
          <p class="text-gray-500 text-sm">No past events attended.</p>
        ) : (
          <ul class="space-y-2">
            {pastEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <p class="font-medium text-gray-900">{e.title}</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    {formatDate(e.startDate)}
                    {(e.city || e.country) && (
                      <> · {[e.city, e.country].filter(Boolean).join(", ")}</>
                    )}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Election History — owner only */}
      {isOwner && electionGroups && electionGroups.length > 0 && (
        <section>
          <h2 class="text-xl font-semibold text-gray-800 mb-3">Election History</h2>
          <div class="space-y-3">
            {electionGroups.map((group) => (
              <div
                key={group.title}
                class="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div class="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
                  {group.title}
                </div>
                <ul class="divide-y divide-gray-100">
                  {group.apps.map((app) => (
                    <li
                      key={app.id}
                      class="px-4 py-3 flex items-center justify-between"
                    >
                      <span class="text-sm text-gray-800">
                        {app.position?.title ?? "—"}
                      </span>
                      <span
                        class={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls(app.status)}`}
                      >
                        {app.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Submitted Forms — owner only */}
      {isOwner && submittedForms && submittedForms.length > 0 && (
        <section>
          <h2 class="text-xl font-semibold text-gray-800 mb-3">Submitted Forms</h2>
          <ul class="space-y-2">
            {submittedForms.map((submission) => (
              <li key={submission.id} class="border border-gray-200 rounded-lg p-4">
                <a
                  href={submission.path}
                  class="text-blue-600 hover:underline font-medium"
                >
                  {submission.title}
                </a>
                <p class="text-sm text-gray-500 mt-1">
                  Submitted {new Date(submission.submittedAt).toLocaleString()}
                </p>
                {submission.responseEntries.length > 0 && (
                  <dl class="mt-3 space-y-1">
                    {submission.responseEntries.map((entry) => (
                      <div
                        key={entry.question}
                        class="grid grid-cols-1 md:grid-cols-3 gap-1"
                      >
                        <dt class="text-sm text-gray-600 break-words">
                          {entry.question}
                        </dt>
                        <dd class="text-sm text-gray-900 md:col-span-2 break-words">
                          {entry.answer}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});
