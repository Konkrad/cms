import { component$ } from "@qwik.dev/core";
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
    onAssignmentsChange$,
    onSearchQueryChange$,
    onSearchResultsChange$,
    onSearchLoadingChange$,
    onSearchErrorChange$,
  }) => {
    return (
      <div class="space-y-6">
        <div class="border rounded-lg p-6 bg-white">
          <h2 class="text-xl font-bold mb-1">Participant Assignment</h2>
          <p class="text-sm text-gray-600">
            Assign each ticket slot. You can search existing users by name or type details manually.
          </p>
        </div>

        {groupedAssignments.map((productGroup) => (
          <div key={productGroup.productId} class="border rounded-lg p-6 bg-white space-y-4">
            <div>
              <h3 class="text-lg font-semibold">{productGroup.productName}</h3>
              <p class="text-sm text-gray-600">
                {productGroup.units.length} {productGroup.units.length === 1 ? "ticket" : "tickets"}
              </p>
            </div>

            {productGroup.units.map((unit) => (
              <div key={unit.unitKey} class="rounded-sm border p-4 space-y-3">
                <p class="text-sm font-medium">Ticket {unit.unitNumber}</p>

                {unit.slots.map((slot, slotIdx) => {
                  const currentUnitKey = unit.unitKey;
                  const slotKey = `${unit.unitKey}:${slotIdx}`;
                  const queryValue = slotSearchQuery[slotKey] || "";
                  const searchResults = slotSearchResults[slotKey] || [];
                  const isSearchLoading = slotSearchLoading[slotKey] || false;
                  const searchErr = slotSearchError[slotKey] || "";

                  return (
                    <div key={slotKey} class="border rounded-sm p-4 space-y-3">
                      <p class="font-medium">Participant {slotIdx + 1}</p>

                      {!slot.locked && (
                        <div class="space-y-2">
                          <label class="text-sm font-medium block">Find existing user by name</label>
                          <input
                            type="text"
                            value={queryValue}
                            class="w-full px-3 py-2 border rounded-lg"
                            placeholder="Search by name"
                            onInput$={async (_, el) => {
                              const nextQuery = el.value;
                              onSearchQueryChange$(slotKey, nextQuery);

                              if (nextQuery.trim().length < 2) {
                                onSearchResultsChange$(slotKey, []);
                                onSearchLoadingChange$(slotKey, false);
                                onSearchErrorChange$(slotKey, "");
                                return;
                              }

                              onSearchLoadingChange$(slotKey, true);
                              onSearchErrorChange$(slotKey, "");

                              const requestQuery = nextQuery.trim();
                              try {
                                const response = await fetch(`/api/users/search?q=${encodeURIComponent(requestQuery)}`, {
                                  method: "GET",
                                  credentials: "same-origin",
                                  headers: { Accept: "application/json" },
                                });

                                if ((slotSearchQuery[slotKey] || "").trim() !== requestQuery) {
                                  return;
                                }

                                if (!response.ok) {
                                  const message =
                                    response.status === 401
                                      ? "Please log in again to search users."
                                      : "User search failed. Please try again.";
                                  onSearchResultsChange$(slotKey, []);
                                  onSearchErrorChange$(slotKey, message);
                                  return;
                                }

                                const payload = await response.json();
                                const users = (payload?.users || []) as SearchUserResult[];
                                onSearchResultsChange$(slotKey, users);
                              } catch {
                                onSearchResultsChange$(slotKey, []);
                                onSearchErrorChange$(slotKey, "User search failed. Please try again.");
                              } finally {
                                onSearchLoadingChange$(slotKey, false);
                              }
                            }}
                          />

                          {slot.existingUserId && (
                            <button
                              type="button"
                              class="text-xs text-red-600 hover:underline"
                              onClick$={() => {
                                const nextAssignments = assignments.map((u) => {
                                  if (u.unitKey !== currentUnitKey) return u;
                                  const nextSlots = [...u.slots];
                                  nextSlots[slotIdx] = {
                                    ...nextSlots[slotIdx],
                                    name: "",
                                    email: "",
                                    existingUserId: null,
                                  };
                                  return { ...u, slots: nextSlots };
                                });
                                onAssignmentsChange$(nextAssignments);
                                onSearchQueryChange$(slotKey, "");
                                onSearchResultsChange$(slotKey, []);
                                onSearchErrorChange$(slotKey, "");
                              }}
                            >
                              Remove selected user
                            </button>
                          )}

                          {isSearchLoading && <p class="text-xs text-gray-500">Searching...</p>}

                          {!isSearchLoading && searchErr && <p class="text-xs text-red-600">{searchErr}</p>}

                          {!isSearchLoading && !searchErr && queryValue.trim().length >= 2 && searchResults.length === 0 && (
                            <p class="text-xs text-gray-500">No users found.</p>
                          )}

                          {searchResults.length > 0 && (
                            <div class="border rounded-sm max-h-52 overflow-auto">
                              {searchResults.map((result) => (
                                <button
                                  type="button"
                                  key={result.id}
                                  class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                                  onClick$={() => {
                                    const nextAssignments = assignments.map((u) => {
                                      if (u.unitKey !== currentUnitKey) return u;
                                      const nextSlots = [...u.slots];
                                      nextSlots[slotIdx] = {
                                        ...nextSlots[slotIdx],
                                        name: result.displayName,
                                        email: result.email,
                                        existingUserId: result.id,
                                      };
                                      return { ...u, slots: nextSlots };
                                    });
                                    onAssignmentsChange$(nextAssignments);
                                    onSearchQueryChange$(slotKey, result.displayName);
                                    onSearchResultsChange$(slotKey, []);
                                  }}
                                >
                                  {result.avatarUrl ? (
                                    <img src={result.avatarUrl} alt={result.displayName} class="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div class="w-8 h-8 rounded-full bg-gray-200"></div>
                                  )}
                                  <div>
                                    <p class="font-medium text-sm">{result.displayName}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="space-y-1">
                          <label class="text-sm font-medium block">Name</label>
                          <input
                            type="text"
                            class="w-full px-3 py-2 border rounded-lg"
                            value={slot.name}
                            disabled={slot.locked}
                            onInput$={(_, el) => {
                              const nextAssignments = assignments.map((u) => {
                                if (u.unitKey !== currentUnitKey) return u;
                                const nextSlots = [...u.slots];
                                nextSlots[slotIdx] = {
                                  ...nextSlots[slotIdx],
                                  name: el.value,
                                  existingUserId: null,
                                };
                                return { ...u, slots: nextSlots };
                              });
                              onAssignmentsChange$(nextAssignments);
                            }}
                          />
                        </div>

                        <div class="space-y-1">
                          <label class="text-sm font-medium block">Email</label>
                          <input
                            type="email"
                            class="w-full px-3 py-2 border rounded-lg"
                            value={slot.email}
                            disabled={slot.locked}
                            onInput$={(_, el) => {
                              const nextAssignments = assignments.map((u) => {
                                if (u.unitKey !== currentUnitKey) return u;
                                const nextSlots = [...u.slots];
                                nextSlots[slotIdx] = {
                                  ...nextSlots[slotIdx],
                                  email: el.value,
                                  existingUserId: null,
                                };
                                return { ...u, slots: nextSlots };
                              });
                              onAssignmentsChange$(nextAssignments);
                            }}
                          />
                        </div>
                      </div>

                      {slot.locked && (
                        <div class="rounded-sm border bg-gray-50 px-3 py-2">
                          <p class="text-xs text-gray-600 mb-2">
                            First ticket, first participant is reserved for your account.
                          </p>
                          <div class="flex items-center gap-2">
                            {buyer.avatarUrl ? (
                              <img src={buyer.avatarUrl} alt={buyer.name || "Your profile"} class="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div class="w-8 h-8 rounded-full bg-gray-200"></div>
                            )}
                            <div class="min-w-0">
                              <p class="text-sm font-medium truncate">{buyer.name || slot.name}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

        <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
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
