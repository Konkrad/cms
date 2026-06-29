import type { RequestEvent } from "@qwik.dev/router";
import { getServerSession } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import type { ConsentStep, User } from "~/db/schemas/users";

const STEP_TO_ROUTE: Record<ConsentStep, string> = {
  profile: "",
  locationVerification: "",
  foodPreference: "",
  lastProfileUpdate: "",
  photoConsent: "",
  survey: "",
};

export const ONBOARDING_STEPS: ConsentStep[] = ["profile"];

export type ConsentStatus = {
  completed: Record<ConsentStep, boolean>;
  nextStep?: ConsentStep;
};

export function getConsentStatus(user: User): ConsentStatus {
  const consent = (user as any).consent as Record<string, string | null> | undefined;

  const completed: Record<ConsentStep, boolean> = {
    profile: Boolean(consent?.profile),
    locationVerification: Boolean(consent?.locationVerification),
    foodPreference: Boolean(consent?.foodPreference),
    lastProfileUpdate: Boolean(consent?.lastProfileUpdate),
    photoConsent: Boolean(consent?.photoConsent),
    survey: Boolean(consent?.survey),
  };

  const nextStep = ONBOARDING_STEPS.find((step) => !completed[step]);

  return {
    completed,
    nextStep,
  };
}

export function getConsentStepRoute(step: ConsentStep): string {
  // All onboarding is handled in a single route.
  return "/onboarding";
}

export function getNextConsentRoute(user: User): string | null {
  const status = getConsentStatus(user);

  // Always send to the single onboarding route until profile is done.
  if (!status.completed.profile) {
    return "/onboarding";
  }

  // If you've already completed profile, don't force any further steps.
  return null;
}

export async function markConsentStepComplete(
  userId: string,
  step: ConsentStep,
  when: string = new Date().toISOString(),
) {
  const user = await usersService.getById(userId);
  if (!user) return;

  const existingConsent = (user as any).consent as Record<string, string | null> | undefined;
  const nextConsent = {
    ...(existingConsent || {}),
    [step]: when,
  };

  await usersService.update(userId, {
    consent: nextConsent,
  } as any);
}

export async function requireConsentCompleted(event: RequestEvent) {
  const user = await getServerSession(event);
  if (!user) {
    throw event.redirect(302, "/login");
  }

  const fullUser = await usersService.getById(user.id);
  if (!fullUser) {
    throw event.redirect(302, "/login");
  }

  const nextRoute = getNextConsentRoute(fullUser);
  if (nextRoute) {
    throw event.redirect(302, nextRoute);
  }

  return fullUser;
}
