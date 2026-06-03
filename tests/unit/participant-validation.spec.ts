import { describe, it, expect } from "vitest";
import { isValidEmail, validateParticipantSlots } from "~/utils/participant-validation";

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@sub.domain.org")).toBe(true);
  });

  it("rejects missing TLD", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateParticipantSlots", () => {
  const unit = (slots: Array<{ name: string; email: string }>) => ({
    productName: "Workshop",
    slots,
  });

  it("returns null when all slots are fully filled with valid data", () => {
    expect(
      validateParticipantSlots([
        unit([{ name: "Alice", email: "alice@example.com" }]),
      ]),
    ).toBeNull();
  });

  it("returns null when a slot is completely empty (allowed — assign later)", () => {
    expect(
      validateParticipantSlots([
        unit([
          { name: "Alice", email: "alice@example.com" },
          { name: "", email: "" },
        ]),
      ]),
    ).toBeNull();
  });

  it("returns null for multiple units where some slots are empty", () => {
    expect(
      validateParticipantSlots([
        unit([{ name: "Alice", email: "alice@example.com" }]),
        unit([{ name: "", email: "" }]),
      ]),
    ).toBeNull();
  });

  it("errors when slot has name but no email", () => {
    const result = validateParticipantSlots([
      unit([{ name: "Alice", email: "" }]),
    ]);
    expect(result).toMatch(/email/i);
    expect(result).toMatch(/Workshop/);
    expect(result).toMatch(/participant 1/);
  });

  it("errors when slot has email but no name", () => {
    const result = validateParticipantSlots([
      unit([{ name: "", email: "alice@example.com" }]),
    ]);
    expect(result).toMatch(/name/i);
    expect(result).toMatch(/participant 1/);
  });

  it("errors when email format is invalid", () => {
    const result = validateParticipantSlots([
      unit([{ name: "Alice", email: "not-an-email" }]),
    ]);
    expect(result).toMatch(/not-an-email/);
    expect(result).toMatch(/valid email/i);
  });

  it("reports the correct participant index", () => {
    const result = validateParticipantSlots([
      unit([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "" }, // participant 2 is broken
      ]),
    ]);
    expect(result).toMatch(/participant 2/);
  });

  it("reports the product name in the error", () => {
    const result = validateParticipantSlots([
      { productName: "Yoga Class", slots: [{ name: "Alice", email: "" }] },
    ]);
    expect(result).toMatch(/Yoga Class/);
  });

  it("returns null for an empty units array", () => {
    expect(validateParticipantSlots([])).toBeNull();
  });
});
