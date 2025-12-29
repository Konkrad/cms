# Quickstart: Event Participation Tracking Implementation

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Branch**: `002-event-participation-tracking`

## Prerequisites

- Node.js 20+
- Git repository access
- Cloudflare R2 account (or S3-compatible storage) for photo storage
- Existing project setup complete (Qwik, Drizzle, SQLite)

## Environment Setup

Add the following to `.env` (and `.env.example`):

```bash
# R2/S3 Configuration for Event Photos
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=cms-event-photos
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
```

Then update `src/env.ts`:

```typescript
// Add to existing env schema
export const envSchema = z.object({
  // ... existing vars
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
});
```

## Database Migration

### Step 1: Create Migration Files

```bash
# Generate migration (Drizzle will detect schema changes)
npm run db:generate
```

### Step 2: Create Schema Files

Create the following files in `src/db/schemas/`:

**participants.ts**:
```typescript
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { events } from "./events";
import crypto from "crypto";

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'yes' | 'no' | 'maybe' | 'verified'
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Unique constraint on (userId, eventId)
export const participantsRelations = relations(participants, ({ one }) => ({
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [participants.eventId],
    references: [events.id],
  }),
}));

const baseInsertSchema = createInsertSchema(participants);
const baseSelectSchema = createSelectSchema(participants);

export const participantStatusEnum = z.enum(["yes", "no", "maybe", "verified"]);

export const insertParticipantSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    status: participantStatusEnum,
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateParticipantSchema = baseInsertSchema
  .pick({ status: true, updatedAt: true })
  .extend({
    status: participantStatusEnum,
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial();

export const selectParticipantSchema = baseSelectSchema;

export type Participant = z.infer<typeof selectParticipantSchema>;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type UpdateParticipant = z.infer<typeof updateParticipantSchema>;
```

**event-photos.ts**:
```typescript
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { users } from "./users";
import crypto from "crypto";

export const eventPhotos = sqliteTable("event_photos", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(), // S3/R2 object key
  uploadedAt: text("uploaded_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
});

export const eventPhotosRelations = relations(eventPhotos, ({ one }) => ({
  event: one(events, {
    fields: [eventPhotos.eventId],
    references: [events.id],
  }),
  uploader: one(users, {
    fields: [eventPhotos.uploadedBy],
    references: [users.id],
  }),
}));

const baseInsertSchema = createInsertSchema(eventPhotos);
const baseSelectSchema = createSelectSchema(eventPhotos);

export const insertEventPhotoSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    uploadedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    uploadedAt: true,
  });

export const selectEventPhotoSchema = baseSelectSchema;

export type EventPhoto = z.infer<typeof selectEventPhotoSchema>;
export type InsertEventPhoto = z.infer<typeof insertEventPhotoSchema>;
```

### Step 3: Modify Existing Schemas

**events.ts** - Add isFree field:
```typescript
// Add to events table definition
export const events = sqliteTable("events", {
  // ... existing fields
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  // ... rest of fields
});
```

**inventory-groups.ts** - Add sales period fields:
```typescript
// Add to inventoryGroups table definition
export const inventoryGroups = sqliteTable("inventory_groups", {
  // ... existing fields
  salesStartDate: text("sales_start_date"),
  salesEndDate: text("sales_end_date"),
  // ... rest of fields
});
```

### Step 4: Update Schema Aggregator

**src/db/schema.ts**:
```typescript
// Add exports
export * from "./schemas/participants";
export * from "./schemas/event-photos";
```

### Step 5: Run Migration

```bash
# Apply migration to database
npm run db:migrate
```

## Service Layer Implementation

Create the following service files in `src/services/`:

**participants.service.ts**:
```typescript
import { db } from "~/db/connection";
import { participants } from "~/db/schemas/participants";
import { eq, and } from "drizzle-orm";
import type { InsertParticipant, UpdateParticipant } from "~/db/schemas/participants";

export const participantsService = {
  async create(data: InsertParticipant) {
    const [participant] = await db.insert(participants).values(data).returning();
    return participant;
  },

  async upsert(userId: string, eventId: string, status: string) {
    // SQLite doesn't have UPSERT, so check then insert/update
    const existing = await this.findByUserAndEvent(userId, eventId);
    
    if (existing) {
      return this.update(existing.id, { status, updatedAt: new Date().toISOString() });
    } else {
      return this.create({ userId, eventId, status });
    }
  },

  async findByUserAndEvent(userId: string, eventId: string) {
    return db.query.participants.findFirst({
      where: and(
        eq(participants.userId, userId),
        eq(participants.eventId, eventId)
      ),
    });
  },

  async update(id: string, data: UpdateParticipant) {
    const [updated] = await db
      .update(participants)
      .set(data)
      .where(eq(participants.id, id))
      .returning();
    return updated;
  },

  async countByEvent(eventId: string) {
    // Returns count grouped by status
    return db
      .select({ status: participants.status, count: sql`count(*)` })
      .from(participants)
      .where(eq(participants.eventId, eventId))
      .groupBy(participants.status);
  },
};
```

**ticket-scanning.service.ts**:
```typescript
import { db } from "~/db/connection";
import { tickets } from "~/db/schemas/tickets";
import { participants } from "~/db/schemas/participants";
import { eq, and, isNull } from "drizzle-orm";

export const ticketScanningService = {
  async scanTicket(qrCodeUuid: string, eventId: string) {
    return db.transaction(async (tx) => {
      // Find ticket
      const ticket = await tx.query.tickets.findFirst({
        where: and(
          eq(tickets.qrCodeUuid, qrCodeUuid),
          eq(tickets.eventId, eventId),
          isNull(tickets.scannedAt)
        ),
        with: {
          buyer: true,
        },
      });

      if (!ticket) {
        throw new Error("Ticket not found or already scanned");
      }

      // Update ticket
      const [scannedTicket] = await tx
        .update(tickets)
        .set({ scannedAt: new Date().toISOString() })
        .where(eq(tickets.id, ticket.id))
        .returning();

      // Update participant to verified
      const existing = await tx.query.participants.findFirst({
        where: and(
          eq(participants.userId, ticket.buyerId),
          eq(participants.eventId, eventId)
        ),
      });

      if (existing) {
        await tx
          .update(participants)
          .set({ status: "verified", updatedAt: new Date().toISOString() })
          .where(eq(participants.id, existing.id));
      } else {
        await tx.insert(participants).values({
          userId: ticket.buyerId,
          eventId: eventId,
          status: "verified",
        });
      }

      return { ticket: scannedTicket, attendee: ticket.buyer };
    });
  },
};
```

**event-photos.service.ts**:
```typescript
import { db } from "~/db/connection";
import { eventPhotos } from "~/db/schemas/event-photos";
import { participants } from "~/db/schemas/participants";
import { eq, and } from "drizzle-orm";
import type { InsertEventPhoto } from "~/db/schemas/event-photos";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const eventPhotosService = {
  async uploadPhoto(file: File, eventId: string, uploadedBy: string) {
    const photoId = crypto.randomUUID();
    const ext = file.name.split(".").pop();
    const key = `events/${eventId}/photos/${photoId}.${ext}`;

    // Upload to R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: await file.arrayBuffer(),
        ContentType: file.type,
      })
    );

    // Save to database
    const [photo] = await db.insert(eventPhotos).values({
      eventId,
      key,
      uploadedBy,
    }).returning();

    return photo;
  },

  async getEventPhotos(eventId: string) {
    return db.query.eventPhotos.findMany({
      where: eq(eventPhotos.eventId, eventId),
      with: {
        uploader: {
          columns: { id: true, name: true },
        },
      },
      orderBy: (photos, { desc }) => [desc(photos.uploadedAt)],
    });
  },

  async generatePresignedUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  },

  async canUserAccessPhotos(userId: string, eventId: string) {
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.userId, userId),
        eq(participants.eventId, eventId)
      ),
    });

    return participant?.status === "verified";
  },
};
```

## Testing

Run existing test suite to ensure no regressions:

```bash
npm run test
```

## Development Workflow

1. **Checkout feature branch**:
   ```bash
   git checkout 002-event-participation-tracking
   ```

2. **Install dependencies** (if needed):
   ```bash
   npm install
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Verify changes**:
   - Check database schema in SQLite browser
   - Test endpoints via Qwik dev mode
   - Review UI components in browser

## Next Steps (Phase 2 - Implementation)

Phase 2 (tasks.md generation via `/speckit.tasks`) will create:
- Detailed task breakdown for implementation
- Component development tasks
- Route handler tasks
- Integration test scenarios
- Deployment checklist

This quickstart provides the foundation for implementing all features defined in the data model and contracts.
