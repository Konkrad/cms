import { component$, useStore, type QRL } from "@qwik.dev/core";
import type { SearchUserResult } from "~/components/events/checkout/types";

export type ParticipantFormSlot = {
  name: string;
  email: string;
  existingUserId?: string | null;
  locked?: boolean;
};

type ParticipantFormProps = {
  slots: ParticipantFormSlot[];
  totalSlots: number;
  buyer?: { name: string; avatarUrl: string | null };
  /** Participants already assigned elsewhere, shown as quick-picks */
  previouslyAdded?: ParticipantFormSlot[];
  onSlotsChange$: QRL<(slots: ParticipantFormSlot[]) => void>;
};

export const ParticipantForm = component$<ParticipantFormProps>(
  ({ slots, totalSlots, buyer, previouslyAdded = [], onSlotsChange$ }) => {
    const ui = useStore<{
      focused: boolean;
      manualMode: boolean;
      manualName: string;
      manualEmail: string;
      searchQuery: string;
      searchResults: SearchUserResult[];
      searchLoading: boolean;
      searchError: string;
    }>({
      focused: false,
      manualMode: false,
      manualName: "",
      manualEmail: "",
      searchQuery: "",
      searchResults: [],
      searchLoading: false,
      searchError: "",
    });

    const assignedCount = slots.filter((s) => s.name || s.existingUserId).length;
    const hasOpenSlot = assignedCount < totalSlots;

    return (
      <div class="space-y-4">
        {/* Assigned participants */}
        {slots.some((s) => s.locked || s.name || s.existingUserId) && (
          <div class="space-y-2">
            {slots.map((slot, idx) => {
              if (!slot.locked && !slot.name && !slot.existingUserId) return null;
              return (
                <div
                  key={idx}
                  class="flex items-center gap-3 py-2 border-b last:border-b-0"
                >
                  {slot.locked && buyer?.avatarUrl ? (
                    <img
                      src={buyer.avatarUrl}
                      alt={buyer.name}
                      class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                  )}
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">
                      {slot.locked ? buyer?.name || slot.name : slot.name}
                    </p>
                    <p class="text-xs text-gray-500">Participant {idx + 1}</p>
                  </div>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:underline flex-shrink-0"
                    onClick$={() => {
                      const next = slots.map((s, i) =>
                        i === idx
                          ? { ...s, name: "", email: "", existingUserId: null, locked: false }
                          : s,
                      );
                      onSlotsChange$(next);
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search / manual entry — only when open slots exist */}
        {hasOpenSlot && (
          <div class="space-y-2">
            {ui.manualMode ? (
              <div class="border rounded-lg p-3 space-y-2 bg-gray-50">
                <p class="text-xs font-medium text-gray-600">
                  Add participant manually
                </p>
                <input
                  type="text"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Full name"
                  value={ui.manualName}
                  onInput$={(_, el) => {
                    ui.manualName = el.value;
                  }}
                />
                <input
                  type="email"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Email address"
                  value={ui.manualEmail}
                  onInput$={(_, el) => {
                    ui.manualEmail = el.value;
                  }}
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-40"
                    disabled={
                      !ui.manualName.trim() ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ui.manualEmail)
                    }
                    onClick$={() => {
                      const name = ui.manualName.trim();
                      const email = ui.manualEmail.trim();
                      if (!name || !email) return;
                      let filled = false;
                      const next = slots.map((s) => {
                        if (filled || s.locked || s.name || s.existingUserId)
                          return s;
                        filled = true;
                        return { ...s, name, email, existingUserId: null };
                      });
                      onSlotsChange$(next);
                      ui.manualMode = false;
                      ui.manualName = "";
                      ui.manualEmail = "";
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    class="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-100"
                    onClick$={() => {
                      ui.manualMode = false;
                      ui.manualName = "";
                      ui.manualEmail = "";
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={ui.searchQuery}
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Search participant by name…"
                  onFocus$={() => {
                    ui.focused = true;
                  }}
                  onBlur$={() => {
                    ui.focused = false;
                  }}
                  onInput$={async (_, el) => {
                    const q = el.value;
                    ui.searchQuery = q;

                    if (q.trim().length < 2) {
                      ui.searchResults = [];
                      ui.searchLoading = false;
                      ui.searchError = "";
                      return;
                    }

                    ui.searchLoading = true;
                    ui.searchError = "";

                    try {
                      const resp = await fetch(
                        `/api/users/search?q=${encodeURIComponent(q.trim())}`,
                        {
                          method: "GET",
                          credentials: "same-origin",
                          headers: { Accept: "application/json" },
                        },
                      );

                      if (!resp.ok) {
                        ui.searchResults = [];
                        ui.searchError =
                          resp.status === 401
                            ? "Please log in again to search users."
                            : "User search failed. Please try again.";
                        return;
                      }

                      const payload = await resp.json();
                      ui.searchResults = (payload?.users || []) as SearchUserResult[];
                    } catch {
                      ui.searchResults = [];
                      ui.searchError = "User search failed. Please try again.";
                    } finally {
                      ui.searchLoading = false;
                    }
                  }}
                />

                {ui.searchLoading && (
                  <p class="text-xs text-gray-500 mt-1">Searching…</p>
                )}
                {!ui.searchLoading && ui.searchError && (
                  <p class="text-xs text-red-600 mt-1">{ui.searchError}</p>
                )}

                {(ui.focused || ui.searchResults.length > 0) && (
                  <div class="border rounded-lg overflow-hidden mt-1">
                    {/* Manual entry — always first */}
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b flex items-center gap-3"
                      onMouseDown$={(e) => {
                        e.preventDefault();
                      }}
                      onClick$={() => {
                        ui.manualMode = true;
                        ui.focused = false;
                        ui.searchQuery = "";
                        ui.searchResults = [];
                      }}
                    >
                      <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-lg leading-none">
                        +
                      </div>
                      <div>
                        <p class="text-sm font-medium">Add manually</p>
                        <p class="text-xs text-gray-500">
                          Enter name and email address
                        </p>
                      </div>
                    </button>

                    {/* Search results */}
                    {ui.searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                        onMouseDown$={(e) => {
                          e.preventDefault();
                        }}
                        onClick$={() => {
                          let filled = false;
                          const next = slots.map((s) => {
                            if (filled || s.locked || s.name || s.existingUserId)
                              return s;
                            filled = true;
                            return {
                              ...s,
                              name: user.displayName,
                              // Email is intentionally not exposed by the search
                              // API; it is resolved server-side from existingUserId
                              // at checkout.
                              email: "",
                              existingUserId: user.id,
                            };
                          });
                          onSlotsChange$(next);
                          ui.searchQuery = "";
                          ui.searchResults = [];
                          ui.focused = false;
                        }}
                      >
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                        )}
                        <div class="min-w-0">
                          <p class="text-sm font-medium truncate">
                            {user.displayName}
                          </p>
                        </div>
                      </button>
                    ))}

                    {/* Previously added quick-picks (shown only when no search results) */}
                    {ui.searchResults.length === 0 &&
                      previouslyAdded.length > 0 && (
                        <>
                          <p class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                            Previously added
                          </p>
                          {previouslyAdded.map((p, i) => (
                            <button
                              key={i}
                              type="button"
                              class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                              onMouseDown$={(e) => {
                                e.preventDefault();
                              }}
                              onClick$={() => {
                                let filled = false;
                                const next = slots.map((s) => {
                                  if (
                                    filled ||
                                    s.locked ||
                                    s.name ||
                                    s.existingUserId
                                  )
                                    return s;
                                  filled = true;
                                  return {
                                    ...s,
                                    name: p.name,
                                    email: p.email,
                                    existingUserId: p.existingUserId ?? null,
                                  };
                                });
                                onSlotsChange$(next);
                                ui.focused = false;
                              }}
                            >
                              <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                              <div class="min-w-0">
                                <p class="text-sm font-medium truncate">
                                  {p.name}
                                </p>
                                <p class="text-xs text-gray-500 truncate">
                                  {p.email}
                                </p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
