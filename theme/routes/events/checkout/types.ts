import type { Signal } from "@qwik.dev/core";

export type ParticipantSlotInput = {
  name: string;
  email: string;
  existingUserId?: string | null;
};

export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  participantUnits?: ParticipantSlotInput[][];
};

export type ParticipantSlot = {
  name: string;
  email: string;
  existingUserId?: string | null;
  locked?: boolean;
};

export type ParticipantAssignmentUnit = {
  unitKey: string;
  productId: string;
  productName: string;
  unitNumber: number;
  slots: ParticipantSlot[];
};

export type SearchUserResult = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type GroupedAssignments = {
  productId: string;
  productName: string;
  units: ParticipantAssignmentUnit[];
};

export type SelectedProductsSignal = Signal<Record<string, number>>;
export type ParticipantAssignmentsSignal = Signal<ParticipantAssignmentUnit[]>;
