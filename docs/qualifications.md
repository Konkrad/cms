# Qualifications

Despite the name, this isn't specifically about academic degrees — it's a
general-purpose way to verify members against some criterion and, once
verified, upgrade their membership tier. An admin defines a *qualification
type* representing that criterion; a member submits a claim against it; an
admin reviews and approves or rejects the claim; approval can upgrade the
member's tier and/or assign them a tag.

This is always managed platform-wide, in the Global Admin area, since
qualifications aren't tied to one specific community.

## The three pieces

- **Qualification types** — the criteria an admin defines. Each has a name,
  a description, and which membership tier it grants ("associated" or
  "full") once approved for a member.
- **Member claims** — one per member per qualification type they've applied
  for, with a status: pending, approved, or rejected, plus who reviewed it
  and any notes.
- **Verification codes** — time-limited, revocable QR codes tied to one
  qualification type. The intended use is in-person verification: display
  or print a QR code at an event or info desk, and scanning it lets someone
  submit a claim for that qualification type on the spot — which still
  lands in the pending review queue rather than being approved
  automatically.

## What an admin can do

- Create or delete qualification types
- Approve or reject a pending claim
- Generate or revoke a verification QR code for a type
