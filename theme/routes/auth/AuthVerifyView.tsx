import { component$ } from "@qwik.dev/core";
import type { AuthVerifyViewData } from "~/contracts/auth";

/**
 * Themed view for the magic-link verification route (`/auth/verify`). The
 * loader normally redirects on success, so this only ever renders the
 * loading/error states.
 */
export const AuthVerifyView = component$<{ result: AuthVerifyViewData }>(({ result }) => {
  if (!result) {
    return <div class="container mx-auto px-4 py-8">Verifying...</div>;
  }

  if (!result.success) {
    return (
      <div class="container mx-auto px-4 py-8 max-w-md">
        <h1 class="text-2xl font-bold mb-2">Verification failed</h1>
        <p class="mb-4 text-gray-700">{result.error}</p>
        <a href="/login" class="text-blue-600 hover:text-blue-800">
          Return to login
        </a>
      </div>
    );
  }

  return null;
});
