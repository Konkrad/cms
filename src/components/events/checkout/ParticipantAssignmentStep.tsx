import { component$, useStore } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type { GroupedAssignments, ParticipantAssignmentUnit, SearchUserResult } from "./types";

type ParticipantAssignmentStepProps = {
  groupedAssignments: GroupedAssignments[];
  assignments: ParticipantAssignmentUnit[];
  slotSearchQuery: Record<string, string>;
  slotSearchResults: Record<string, SearchUserResult[]>;
  slotSearchLoading: Record<string, boolean>;
  slotSearchError: Record<string, string>;
  buyer: {
    name: string;
    avatarUrl: string | null;
  };
  error?: string;
  onBack$: () => void;
  onContinue$: () => void;
  onAssignmentsChange$: (next: ParticipantAssignmentUnit[]) => void;
  onSearchQueryChange$: (slotKey: string, query: string) => void;
  onSearchResultsChange$: (slotKey: string, users: SearchUserResult[]) => void;
  onSearchLoadingChange$: (slotKey: string, isLoading: boolean) => void;
  onSearchErrorChange$: (slotKey: string, message: string) => void;
};

export const ParticipantAssignmentStep = component$<ParticipantAssignmentStepProps>(
  ({
    groupedAssignments,
    assignments,
    slotSearchQuery,
    slotSearchResults,
    slotSearchLoading,
    slotSearchError,
    buyer,
    onBack$,
    onContinue$,
    error,
    onAssignmentsChange$,
    onSearchQueryChange$,
    onSearchResultsChange$,
    onSearchLoadingChange$,
    onSearchErrorChange$,
  }) => {
    const ui = useStore<{
      focused: Record<string, boolean>;
      manualMode: Record<string, boolean>;
      manualName: Record<string, string>;
      manualEmail: Record<string, string>;
    }>({ focused: {}, manualMode: {}, manualName: {}, manualEmail: {} });

    return (
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold mb-1">Participant Assignment</h2>
          <p class="text-sm text-gray-600">
            Search for participants to assign to each ticket.
          </p>
        </div>

        {groupedAssignments.map((productGroup) => {
          const searchKey = productGroup.productId;
          const queryValue = slotSearchQuery[searchKey] || "";
          const searchResults = slotSearchResults[searchKey] || [];
          const isSearchLoading = slotSearchLoading[searchKey] || false;
          const searchErr = slotSearchError[searchKey] || "";

          const flatSlots = productGroup.units.flatMap((unit) =>
            unit.slots.map((slot, slotIdx) => ({ unit, slotIdx, slot })),
          );
          const totalSlots = flatSlots.length;
          const assignedCount = flatSlots.filter((e) => e.slot.name || e.slot.existingUserId).length;
          const hasOpenSlot = assignedCount < totalSlots;

          // Participants already assigned to other products — deduplicated by existingUserId or name+email
          const seen = new Set<string>();
          const previouslyAdded = assignments
            .filter((u) => u.productId !== productGroup.productId)
            .flatMap((u) => u.slots)
            .filter((s) => s.name || s.existingUserId)
            .filter((s) => {
              const key = s.existingUserId ?? `${s.name}|${s.email}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

          return (
            <div key={productGroup.productId} class="border rounded-lg p-6 bg-white space-y-4">
              <div class="flex items-baseline justify-between">
                <h3 class="text-lg font-semibold">{productGroup.productName}</h3>
                <span class="text-sm text-gray-500">
                  {assignedCount}/{totalSlots} assigned
                </span>
              </div>

              {/* Assigned participants list */}
              <div class="space-y-2">
                {flatSlots.map((entry, participantIdx) => {
                  const { unit, slotIdx, slot } = entry;

                  if (!slot.locked && !slot.name && !slot.existingUserId) return null;

                  return (
                    <div key={`${unit.unitKey}:${slotIdx}`} class="flex items-center gap-3 py-2 border-b last:border-b-0">
                      {slot.locked ? (
                        buyer.avatarUrl ? (
                          <img src={buyer.avatarUrl} alt={buyer.name} class="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                        )
                      ) : (
                        <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                      )}
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate">
                          {slot.locked ? buyer.name || slot.name : slot.name}
                        </p>
                        <p class="text-xs text-gray-500">Participant {participantIdx + 1}</p>
                      </div>
                      <button
                        type="button"
                        class="text-xs text-red-600 hover:underline flex-shrink-0"
                        onClick$={() => {
                          const nextAssignments = assignments.map((u) => {
                            if (u.unitKey !== unit.unitKey) return u;
                            const nextSlots = [...u.slots];
                            nextSlots[slotIdx] = {
                              ...nextSlots[slotIdx],
                              name: "",
                              email: "",
                              existingUserId: null,
                              locked: false,
                            };
                            return { ...u, slots: nextSlots };
                          });
                          onAssignmentsChange$(nextAssignments);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Search box — only shown when there are open slots */}
              {hasOpenSlot && (
                <div class="space-y-2">
                  {/* Manual entry form */}
                  {ui.manualMode[searchKey] ? (
                    <div class="border rounded-lg p-3 space-y-2 bg-gray-50">
                      <p class="text-xs font-medium text-gray-600">Add participant manually</p>
                      <input
                        type="text"
                        class="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Full name"
                        value={ui.manualName[searchKey] || ""}
                        onInput$={(_, el) => { ui.manualName[searchKey] = el.value; }}
                      />
                      <input
                        type="email"
                        class="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Email address"
                        value={ui.manualEmail[searchKey] || ""}
                        onInput$={(_, el) => { ui.manualEmail[searchKey] = el.value; }}
                      />
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-40"
                          disabled={!ui.manualName[searchKey]?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ui.manualEmail[searchKey] || "")}
                          onClick$={() => {
                            const name = ui.manualName[searchKey]?.trim();
                            const email = ui.manualEmail[searchKey]?.trim();
                            if (!name || !email) return;
                            let filled = false;
                            const nextAssignments = assignments.map((u) => {
                              if (filled || u.productId !== productGroup.productId) return u;
                              const nextSlots = u.slots.map((s) => {
                                if (filled || s.locked || s.name || s.existingUserId) return s;
                                filled = true;
                                return { ...s, name, email, existingUserId: null };
                              });
                              return { ...u, slots: nextSlots };
                            });
                            onAssignmentsChange$(nextAssignments);
                            ui.manualMode[searchKey] = false;
                            ui.manualName[searchKey] = "";
                            ui.manualEmail[searchKey] = "";
                          }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          class="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-100"
                          onClick$={() => {
                            ui.manualMode[searchKey] = false;
                            ui.manualName[searchKey] = "";
                            ui.manualEmail[searchKey] = "";
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
                        value={queryValue}
                        class="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Search participant by name…"
                        onFocus$={() => { ui.focused[searchKey] = true; }}
                        onBlur$={() => { ui.focused[searchKey] = false; }}
                        onInput$={async (_, el) => {
                          const nextQuery = el.value;
                          onSearchQueryChange$(searchKey, nextQuery);

                          if (nextQuery.trim().length < 2) {
                            onSearchResultsChange$(searchKey, []);
                            onSearchLoadingChange$(searchKey, false);
                            onSearchErrorChange$(searchKey, "");
                            return;
                          }

                          onSearchLoadingChange$(searchKey, true);
                          onSearchErrorChange$(searchKey, "");

                          try {
                            const response = await fetch(`/api/users/search?q=${encodeURIComponent(nextQuery.trim())}`, {
                              method: "GET",
                              credentials: "same-origin",
                              headers: { Accept: "application/json" },
                            });

                            if (!response.ok) {
                              const message =
                                response.status === 401
                                  ? "Please log in again to search users."
                                  : "User search failed. Please try again.";
                              onSearchResultsChange$(searchKey, []);
                              onSearchErrorChange$(searchKey, message);
                              return;
                            }

                            const payload = await response.json();
                            onSearchResultsChange$(searchKey, (payload?.users || []) as SearchUserResult[]);
                          } catch {
                            onSearchResultsChange$(searchKey, []);
                            onSearchErrorChange$(searchKey, "User search failed. Please try again.");
                          } finally {
                            onSearchLoadingChange$(searchKey, false);
                          }
                        }}
                      />

                      {isSearchLoading && <p class="text-xs text-gray-500 mt-1">Searching…</p>}
                      {!isSearchLoading && searchErr && <p class="text-xs text-red-600 mt-1">{searchErr}</p>}

                      {(ui.focused[searchKey] || searchResults.length > 0) && (
                        <div class="border rounded-lg overflow-hidden mt-1">
                          {/* Manual entry — always first */}
                          <button
                            type="button"
                            class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b flex items-center gap-3"
                            onMouseDown$={(e) => { e.preventDefault(); }}
                            onClick$={() => {
                              ui.manualMode[searchKey] = true;
                              ui.focused[searchKey] = false;
                              onSearchQueryChange$(searchKey, "");
                              onSearchResultsChange$(searchKey, []);
                            }}
                          >
                            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-lg leading-none">+</div>
                            <div>
                              <p class="text-sm font-medium">Add manually</p>
                              <p class="text-xs text-gray-500">Enter name and email address</p>
                            </div>
                          </button>

                          {/* Previously added participants from other products */}
                          {previouslyAdded.length > 0 && searchResults.length === 0 && (
                            <>
                              <p class="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50 border-b">Previously added</p>
                              {previouslyAdded.map((prev, i) => (
                                <button
                                  type="button"
                                  key={prev.existingUserId ?? `prev-${i}`}
                                  class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                                  onMouseDown$={(e) => { e.preventDefault(); }}
                                  onClick$={() => {
                                    let filled = false;
                                    const nextAssignments = assignments.map((u) => {
                                      if (filled || u.productId !== productGroup.productId) return u;
                                      const nextSlots = u.slots.map((s) => {
                                        if (filled || s.locked || s.name || s.existingUserId) return s;
                                        filled = true;
                                        return { ...s, name: prev.name, email: prev.email, existingUserId: prev.existingUserId ?? null };
                                      });
                                      return { ...u, slots: nextSlots };
                                    });
                                    onAssignmentsChange$(nextAssignments);
                                    ui.focused[searchKey] = false;
                                  }}
                                >
                                  <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                                  <div>
                                    <p class="text-sm font-medium">{prev.name}</p>
                                    {prev.email && <p class="text-xs text-gray-500">{prev.email}</p>}
                                  </div>
                                </button>
                              ))}
                            </>
                          )}

                          {searchResults.map((result) => (
                            <button
                              type="button"
                              key={result.id}
                              class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                              onMouseDown$={(e) => { e.preventDefault(); }}
                              onClick$={() => {
                                let filled = false;
                                const nextAssignments = assignments.map((u) => {
                                  if (filled || u.productId !== productGroup.productId) return u;
                                  const nextSlots = u.slots.map((s) => {
                                    if (filled || s.locked || s.name || s.existingUserId) return s;
                                    filled = true;
                                    return { ...s, name: result.displayName, email: result.email, existingUserId: result.id };
                                  });
                                  return { ...u, slots: nextSlots };
                                });
                                onAssignmentsChange$(nextAssignments);
                                onSearchQueryChange$(searchKey, "");
                                onSearchResultsChange$(searchKey, []);
                                ui.focused[searchKey] = false;
                              }}
                            >
                              {result.avatarUrl ? (
                                <img src={result.avatarUrl} alt={result.displayName} class="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                              )}
                              <p class="text-sm font-medium">{result.displayName}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
          {error && <p class="text-sm text-red-600 mb-3">{error}</p>}
          <div class="flex gap-4">
            <Button type="button" variant="secondary" class="flex-1" onClick$={onBack$}>
              Back to Products
            </Button>
            <Button type="button" class="flex-1" onClick$={onContinue$}>
              Continue to Payment
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
