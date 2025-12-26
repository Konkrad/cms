# Implementation Plan: Ticket Sales System

**Branch**: `001-ticket-sales` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ticket-sales/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

A comprehensive ticket sales system integrated into the event management platform with multi-tier inventory management, Stripe payment processing, QR code generation, and staff scanning capabilities. The system manages products organized by inventory groups with capacity constraints, processes payments through Stripe Checkout, generates tickets with unique QR codes, and provides transaction management and scanning interfaces.

## Technical Context

**Language/Version**: TypeScript 5.4.5 / Node.js ^18.17.0 || ^20.3.0 || >=21.0.0  
**Primary Dependencies**: Qwik 1.7.3, Drizzle ORM 0.45.1, Stripe SDK 20.1.0, QRCode 1.5.4, React Email 5.1.0, Nodemailer 6.9.3, Node Telegram Bot API 0.67.0  
**Storage**: SQLite (development via better-sqlite3 12.5.0), Turso (production), AWS S3 for image uploads  
**Testing**: Manual testing via quickstart.md checklist (automated testing not in scope)  
**Target Platform**: Web application (Node.js server-side rendering with Qwik)
**Project Type**: Web application with backend services  
**Performance Goals**: Handle 100 concurrent purchases without degradation, checkout completion under 3 minutes, ticket generation under 5 minutes  
**Constraints**: Real-time inventory tracking, atomic payment/inventory operations, idempotent webhook handling  
**Scale/Scope**: Multi-event platform with unlimited products per event, scalable to thousands of concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── routes/                           # Qwik City file-based routing
│   ├── events/[id]/
│   │   └── checkout/                # Customer checkout flow (behind login)
│   │       └── index.tsx            # Ticket selection and Stripe payment
│   ├── profile/
│   │   └── tickets/                 # Customer ticket access
│   │       ├── index.tsx            # List of customer tickets
│   │       └── [id].png/            # QR code image endpoint (public)
│   │           └── index.ts
│   ├── admin/events/[id]/
│   │   ├── products/                # Product management (admin)
│   │   ├── transactions/            # Transaction list (admin)
│   │   └── tickets/                 # Ticket scanning (admin/staff)
│   │       └── index.tsx
│   └── api/
│       └── webhooks/stripe/         # Stripe webhook handler
│           └── index.ts
│
├── services/                        # Business logic layer
│   ├── inventory.service.ts         # Inventory group and product CRUD
│   ├── stripe.service.ts            # Stripe API integration
│   ├── transaction.service.ts       # Transaction management
│   ├── ticket.service.ts            # Ticket generation and QR codes
│   ├── email.service.ts             # Email sending (existing, extended)
│   └── telegram.service.ts          # Telegram notifications (new)
│
├── db/
│   └── schema/
│       ├── inventory-groups.ts      # Inventory group table
│       ├── products.ts              # Products table
│       ├── transactions.ts          # Transactions table
│       ├── transaction-items.ts     # Transaction items table
│       └── tickets.ts               # Tickets table
│
├── emails/                          # React Email templates
│   ├── ticket-confirmation.tsx      # Customer confirmation email
│   └── components/
│       └── ticket-qr.tsx            # QR code component for emails
│
└── components/                      # Reusable UI components
    ├── admin/
    │   ├── product-form.tsx         # Product creation/edit form
    │   ├── inventory-group-form.tsx # Inventory group form
    │   └── qr-scanner.tsx           # QR code scanner component
    └── checkout/
        └── ticket-selector.tsx      # Ticket selection interface
```

**Structure Decision**: Qwik web application with file-based routing. Public checkout is at `/events/[id]/checkout` (behind login), admin interfaces under `/admin/events/[id]/`, customer ticket access at `/profile/tickets/`, and public QR code images at `/profile/tickets/[id].png/`. Services layer handles business logic with direct database access via Drizzle ORM (no repository pattern per constitution).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
