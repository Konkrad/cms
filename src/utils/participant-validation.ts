export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type SlotValidationError = {
  message: string;
};

/**
 * Validates participant slot assignments.
 * Empty slots (no name AND no email) are allowed — participants can be assigned later.
 * Partially-filled slots (only name or only email, or invalid email) are not allowed.
 *
 * Slots linked to an existing user (`existingUserId`) don't carry an email on the
 * client — it is resolved server-side at checkout — so the email check is skipped
 * for them.
 *
 * Returns an error message string on the first failing slot, or null if everything is valid.
 */
export function validateParticipantSlots(
  units: Array<{
    productName: string;
    slots: Array<{ name: string; email: string; existingUserId?: string | null }>;
  }>,
): string | null {
  for (const unit of units) {
    for (let i = 0; i < unit.slots.length; i++) {
      const name = unit.slots[i].name.trim();
      const email = unit.slots[i].email.trim();
      const isLinked = Boolean(unit.slots[i].existingUserId);
      const label = `"${unit.productName}" — participant ${i + 1}`;

      if (!name && !email && !isLinked) continue;

      if (!name) return `Please enter a name for ${label}.`;
      // Linked users get their email server-side; only manual entries need one here.
      if (isLinked) continue;
      if (!email) return `Please enter an email for ${label}.`;
      if (!isValidEmail(email)) return `"${email}" is not a valid email address (${label}).`;
    }
  }
  return null;
}
