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
  affiliationEntries?: { question: string; answer: string }[];
  affiliationEditPath?: string | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const statusCls = (status: string) => {
  if (status === "approved") return "bg-success-bg text-success";
  if (status === "rejected") return "bg-error-bg text-error";
  return "bg-warning-bg text-warning";
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
    affiliationEntries,
    affiliationEditPath,
  } = props;

  const displayName = `${name} ${familyName}`.trim();
  const initials = `${name?.charAt(0) ?? ""}${familyName?.charAt(0) ?? ""}`.toUpperCase();

  const hasPrivateContent =
    isOwner &&
    (!!email ||
      !!yearOfBirth ||
      !!sex ||
      (electionGroups && electionGroups.length > 0) ||
      (submittedForms && submittedForms.length > 0));

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
            class="w-[100px] h-[100px] rounded-full object-cover border-2 border-border shadow-xs shrink-0"
          />
        ) : (
          <div class="w-[100px] h-[100px] rounded-full bg-border flex items-center justify-center border-2 border-border-strong shrink-0">
            <span class="text-text-muted font-semibold text-2xl">{initials}</span>
          </div>
        )}
        <div>
          <h1 class="text-3xl font-bold text-text-heading">{displayName}</h1>
          {(city || country) && (
            <p class="text-text-muted text-sm mt-1">
              {[city, country].filter(Boolean).join(", ")}
            </p>
          )}
          {tags.length > 0 && (
            <div class="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-bg text-info border border-info-border"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Public sections ── */}

      {/* Communities */}
      <section>
        <h2 class="text-xl font-semibold text-text mb-3">Communities</h2>
        {communities.length === 0 ? (
          <p class="text-text-muted text-sm">Not a member of any community yet.</p>
        ) : (
          <ul class="flex flex-wrap gap-2">
            {communities.map((c) => (
              <li key={c.slug}>
                <a
                  href={`/groups/${c.slug}`}
                  class="px-4 py-2 rounded-full bg-bg-muted hover:bg-border transition-colors text-sm font-medium text-text"
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
        <h2 class="text-xl font-semibold text-text mb-3">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <p class="text-text-muted text-sm">No upcoming events.</p>
        ) : (
          <ul class="space-y-2">
            {upcomingEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-border hover:border-border-strong hover:bg-bg transition-colors"
                >
                  <p class="font-medium text-text-heading">{e.title}</p>
                  <p class="text-sm text-text-muted mt-0.5">
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
        <h2 class="text-xl font-semibold text-text mb-3">Past Events</h2>
        {pastEvents.length === 0 ? (
          <p class="text-text-muted text-sm">No past events attended.</p>
        ) : (
          <ul class="space-y-2">
            {pastEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={`/events/${e.id}`}
                  class="block p-4 rounded-xl border border-border hover:border-border-strong hover:bg-bg transition-colors"
                >
                  <p class="font-medium text-text-heading">{e.title}</p>
                  <p class="text-sm text-text-muted mt-0.5">
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

      {/* Relations / Affiliation */}
      {affiliationEntries && affiliationEntries.length > 0 && (
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-semibold text-text">Relations / Affiliation</h2>
            {isOwner && affiliationEditPath && (
              <Link href={affiliationEditPath} class="text-sm font-medium text-primary hover:underline">
                Edit
              </Link>
            )}
          </div>
          <div class="border border-border rounded-lg p-4">
            <dl class="space-y-2">
              {affiliationEntries.map((entry) => (
                <div key={entry.question} class="grid grid-cols-1 md:grid-cols-3 gap-1">
                  <dt class="text-sm text-text-muted">{entry.question}</dt>
                  <dd class="text-sm text-text-heading md:col-span-2 font-medium">{entry.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ── Private sections (owner only) ── */}
      {hasPrivateContent && (
        <div class="border-t-2 border-dashed border-border pt-8 space-y-8">
          <p class="text-xs font-medium text-text-muted uppercase tracking-widest -mb-4">
            Only visible to you
          </p>

          {/* Owner details */}
          <div class="bg-info-bg border border-info-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-wrap">
            <Link
              href="/profile/edit"
              class="text-sm font-medium text-primary hover:underline shrink-0"
            >
              Edit profile
            </Link>
            {email && (
              <span class="text-sm text-text-secondary">
                <span class="font-medium">Email:</span> {email}
              </span>
            )}
            {yearOfBirth && (
              <span class="text-sm text-text-secondary">
                <span class="font-medium">Year of birth:</span> {yearOfBirth}
              </span>
            )}
            {sex && (
              <span class="text-sm text-text-secondary">
                <span class="font-medium">Gender:</span> {sex}
              </span>
            )}
          </div>

          {/* Election History */}
          {electionGroups && electionGroups.length > 0 && (
            <section>
              <h2 class="text-xl font-semibold text-text mb-3">Election History</h2>
              <div class="space-y-3">
                {electionGroups.map((group) => (
                  <div
                    key={group.title}
                    class="border border-border rounded-lg overflow-hidden"
                  >
                    <div class="px-4 py-2 bg-bg border-b text-sm font-medium text-text-secondary">
                      {group.title}
                    </div>
                    <ul class="divide-y divide-gray-100">
                      {group.apps.map((app) => (
                        <li
                          key={app.id}
                          class="px-4 py-3 flex items-center justify-between"
                        >
                          <span class="text-sm text-text">
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

          {/* Submitted Forms */}
          {submittedForms && submittedForms.length > 0 && (
            <section>
              <h2 class="text-xl font-semibold text-text mb-3">Submitted Forms</h2>
              <ul class="space-y-2">
                {submittedForms.map((submission) => (
                  <li key={submission.id} class="border border-border rounded-lg p-4">
                    <a href={submission.path} class="text-primary hover:underline font-medium">
                      {submission.title}
                    </a>
                    <p class="text-sm text-text-muted mt-1">
                      Submitted {new Date(submission.submittedAt).toLocaleString()}
                    </p>
                    {submission.responseEntries.length > 0 && (
                      <dl class="mt-3 space-y-1">
                        {submission.responseEntries.map((entry) => (
                          <div key={entry.question} class="grid grid-cols-1 md:grid-cols-3 gap-1">
                            <dt class="text-sm text-text-secondary break-words">{entry.question}</dt>
                            <dd class="text-sm text-text-heading md:col-span-2 break-words">{entry.answer}</dd>
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
      )}
    </div>
  );
});
