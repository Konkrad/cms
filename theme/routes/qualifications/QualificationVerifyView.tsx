import { component$ } from "@qwik.dev/core";
import type { QualificationVerifyViewData } from "~/contracts/qualifications";

/** Themed view for the qualification verify route (`/qualifications/verify/[token]`). */
export const QualificationVerifyView = component$<{ result: QualificationVerifyViewData }>(
  ({ result }) => {
    if (!result.success) {
      return (
        <div class="min-h-screen flex items-center justify-center px-4">
          <div class="max-w-md w-full text-center">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p class="text-gray-600 mb-6">{result.error}</p>
            <a href="/profile" class="text-blue-600 hover:underline text-sm">Go to my profile</a>
          </div>
        </div>
      );
    }

    if (result.alreadyVerified) {
      return (
        <div class="min-h-screen flex items-center justify-center px-4">
          <div class="max-w-md w-full text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Already Verified</h1>
            <p class="text-gray-600 mb-6">You already have this qualification on your profile.</p>
            <a href="/profile" class="inline-block bg-blue-600 text-white px-5 py-2 rounded-md font-medium hover:bg-blue-700">
              View my profile
            </a>
          </div>
        </div>
      );
    }

    return (
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-md w-full text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Qualification Verified!</h1>
          <p class="text-gray-600 mb-6">
            Your qualification has been verified and added to your profile.
          </p>
          <a href="/profile" class="inline-block bg-green-600 text-white px-5 py-2 rounded-md font-medium hover:bg-green-700">
            View my profile
          </a>
        </div>
      </div>
    );
  },
);
