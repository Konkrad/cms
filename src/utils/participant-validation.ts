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
 * Returns an error message string on the first failing slot, or null if everything is valid.
 */
export function validateParticipantSlots(
  units: Array<{
    productName: string;
    slots: Array<{ name: string; email: string }>;
  }>,
): string | null {
  for (const unit of units) {
    for (let i = 0; i < unit.slots.length; i++) {
      const name = unit.slots[i].name.trim();
      const email = unit.slots[i].email.trim();
      const label = `"${unit.productName}" — participant ${i + 1}`;

      if (!name && !email) continue;

      if (!name) return `Please enter a name for ${label}.`;
      if (!email) return `Please enter an email for ${label}.`;
      if (!isValidEmail(email)) return `"${email}" is not a valid email address (${label}).`;
    }
  }
  return null;
}
