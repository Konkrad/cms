# Quickstart: Event Participation Tracking & Enhanced Features

**Date**: 2025-12-29  
**Target Audience**: Developers implementing the feature

## Overview

This feature adds six enhancements to the existing events system:
1. Ticket scanning for attendance verification
2. Free tickets (no payment required)
3. Multi-participant product capacity
4. Sales period configuration
5. Participation status tracking (yes/no/maybe)
6. Private event photos with secure access (using Uppy.io v5, existing upload endpoint, /private/ storage)

**IMPORTANT**: Most functionality uses **Qwik server functions** (`routeAction$` / `routeLoader$`), NOT REST APIs. Only one true REST endpoint is needed: `/api/photos/serve` for secure file serving with signed URLs.

## Technology Stack

- **QR Generation**: `qrcode` package for server-side QR code creation
- **QR Scanning**: `html5-qrcode` for browser-based camera scanning
- **Photo Upload**: Uppy.io v5 with existing `/api/upload` endpoint
- **Photo Storage**: File system under `/private/events/{eventId}/photos/`
- **Secure URLs**: Node crypto HMAC-SHA256 signing (1-hour expiry)
- **Database**: Drizzle ORM with SQLite, 3 new schemas + 3 extended schemas
- **Communication Pattern**: Qwik server functions (`routeAction$` / `routeLoader$`) for all client-server interactions except photo serving

### Architecture: Server Functions vs REST APIs

**This feature uses Qwik's server functions, NOT REST APIs for most operations:**

| Feature | Implementation | Why |
|---------|---------------|-----|
| Ticket Scanning | `routeAction$` in scan route | Form submission with Zod validation |
| Participation Status | `routeAction$` + `routeLoader$` | State management with session context |
| Photo Upload Metadata | `routeAction$` | Form data after Uppy upload completes |
| Photo Gallery Loading | `routeLoader$` | SSR data loading with attendee validation |
| Secure URL Generation | `routeAction$` | User-specific URL generation |
| **Photo File Serving** | **REST API** `/api/photos/serve` | **Binary file serving with HMAC validation** |

**Key Distinction**:
- **Server Functions**: TypeScript functions that run on the server, called like normal functions from Qwik components. Auto-serialize results, integrate with Qwik's session/context.
- **REST API**: Only needed for `/api/photos/serve` because it must serve binary image data, work with standard `<img>` tags, and validate HMAC signatures without session state.

**Current Ticket System**: Already uses server functions (checkout flow, ticket generation). This feature extends that pattern.

## Prerequisites

1. Node.js 18+ installed
2. Existing CMS running with events system
3. Database access (SQLite development)
4. Environment variables configured in `src/env.ts`

## Installation

### 1. Install Dependencies

```bash
npm install qrcode html5-qrcode @uppy/core @uppy/dashboard @uppy/xhr-upload
npm install --save-dev @types/qrcode
```

### 2. Add Environment Variables

No new environment variables needed for core functionality. Optional: add `PHOTO_URL_SECRET` for custom signing key (defaults to general app secret).

### 3. Database Migration

#### Create New Schema Files

1. **ticket-participants.ts**:
```typescript
// Path: src/db/schemas/ticket-participants.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tickets } from "./tickets";
import crypto from "crypto";

export const ticketParticipants = sqliteTable("ticket_participants", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  participantOrder: integer("participant_order").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  additionalData: text("additional_data", { mode: "json" }).$type<Record<string, any>>(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueTicketOrder: unique().on(table.ticketId, table.participantOrder),
}));

export const ticketParticipantsRelations = relations(ticketParticipants, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketParticipants.ticketId],
    references: [tickets.id],
  }),
}));

const baseInsertSchema = createInsertSchema(ticketParticipants);
const baseSelectSchema = createSelectSchema(ticketParticipants);

export const insertTicketParticipantSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    email: z.string().email(),
    participantOrder: z.number().int().min(1),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({ id: true, phone: true, additionalData: true, createdAt: true });

export const selectTicketParticipantSchema = baseSelectSchema;

export type TicketParticipant = z.infer<typeof selectTicketParticipantSchema>;
export type InsertTicketParticipant = z.infer<typeof insertTicketParticipantSchema>;
```

2. **participation-status.ts**: Similar pattern for participation tracking
3. **event-photos.ts**: Similar pattern for photo storage

#### Extend Existing Schemas

**events.ts** - Add sales period fields:
```typescript
// Add to events table definition
salesStartDate: text("sales_start_date"),
salesEndDate: text("sales_end_date"),

// Update insertEventSchema to handle date transformations
salesStartDate: z.coerce.date().transform((d) => d.toISOString()).optional(),
salesEndDate: z.coerce.date().transform((d) => d.toISOString()).optional(),
```

**products.ts** - Add participant capacity:
```typescript
// Add to products table definition
participantCapacity: integer("participant_capacity").notNull().default(1),

// Update insertProductSchema
participantCapacity: z.number().int().min(1).default(1),
```

**tickets.ts** - Add free ticket flag:
```typescript
// Add to tickets table definition
isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),

// Update insertTicketSchema
isFree: z.boolean().default(false),
```

#### Generate and Run Migrations

```bash
# Generate migration SQL
npx drizzle-kit generate

# Review the generated migration in drizzle/migrations/

# Apply migration
npx drizzle-kit migrate
```

### 4. Update Schema Aggregator

Add new schemas to `src/db/schema.ts`:
```typescript
export * from "./schemas/ticket-participants";
export * from "./schemas/participation-status";
export * from "./schemas/event-photos";
```

## Implementation Guide

### Phase 1: Services Layer

#### 1. Create `src/services/tickets.service.ts`

Key methods:
- `scanTicket(qrData, eventId, scannedBy)`: Validate QR and mark attendance
- `getTicketWithParticipants(ticketId)`: Fetch ticket with participant details
- `validateQRSignature(qrData)`: HMAC validation

#### 2. Create `src/services/photos.service.ts`

Key methods:
- `createPhotoRecord(eventId, filePath, uploadedBy)`: Store photo metadata
- `getEventPhotos(eventId, userId)`: List photos for attended users
- `generateSecureUrl(photoId, userId)`: Create signed URL
- `validateSecureUrl(path, exp, sig)`: Verify signature and expiry

#### 3. Create `src/services/participation.service.ts`

Key methods:
- `updateParticipation(userId, eventId, status)`: Set yes/no/maybe
- `getParticipationSummary(eventId)`: Aggregate counts

#### 4. Extend `src/services/events.service.ts`

Add method:
- `validateSalesPeriod(event)`: Check if sales are active

### Phase 2: Utilities

#### 1. Create `src/utils/qr-code.ts`

```typescript
import QRCode from 'qrcode';
import crypto from 'crypto';

export async function generateTicketQR(ticketId: string, eventId: string): Promise<string> {
  const signature = generateQRSignature(ticketId, eventId);
  const qrData = JSON.stringify({ ticketId, eventId, signature });
  return await QRCode.toDataURL(qrData);
}

export function generateQRSignature(ticketId: string, eventId: string): string {
  const secret = process.env.QR_SECRET || 'default-secret';
  return crypto.createHmac('sha256', secret)
    .update(`${ticketId}:${eventId}`)
    .digest('hex');
}

export function validateQRSignature(qrData: any): boolean {
  const expectedSig = generateQRSignature(qrData.ticketId, qrData.eventId);
  return crypto.timingSafeEqual(
    Buffer.from(qrData.signature),
    Buffer.from(expectedSig)
  );
}
```

#### 2. Create `src/utils/secure-urls.ts`

```typescript
import crypto from 'crypto';

export function generateSecurePhotoUrl(
  photoId: string,
  userId: string,
  filePath: string
): { url: string; expiresAt: string } {
  const expiryTime = Date.now() + 3600000; // 1 hour
  const signature = generateUrlSignature(photoId, userId, expiryTime);
  
  return {
    url: `/api/photos/serve?path=${encodeURIComponent(filePath)}&exp=${expiryTime}&sig=${signature}`,
    expiresAt: new Date(expiryTime).toISOString(),
  };
}

function generateUrlSignature(photoId: string, userId: string, expiryTime: number): string {
  const secret = process.env.PHOTO_URL_SECRET || 'default-secret';
  return crypto.createHmac('sha256', secret)
    .update(`${photoId}:${userId}:${expiryTime}`)
    .digest('hex');
}

export function validateSecureUrl(
  path: string,
  exp: string,
  sig: string,
  userId: string
): boolean {
  const expiryTime = parseInt(exp);
  if (Date.now() > expiryTime) return false;
  
  // Extract photoId from path (implementation depends on path structure)
  const photoId = extractPhotoIdFromPath(path);
  const expectedSig = generateUrlSignature(photoId, userId, expiryTime);
  
  return crypto.timingSafeEqual(
    Buffer.from(sig),
    Buffer.from(expectedSig)
  );
}
```

### Phase 3: Components

#### 1. Create `src/components/events/PhotoUploader.tsx`

```typescript
import { component$, useSignal, $ } from '@builder.io/qwik';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import XHRUpload from '@uppy/xhr-upload';

export const PhotoUploader = component$<{ eventId: string }>(({ eventId }) => {
  const uploadComplete = useSignal(false);
  
  const initUppy = $(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 10 * 1024 * 1024,
        allowedFileTypes: ['image/*'],
      },
    })
    .use(Dashboard, { target: '#uppy-dashboard' })
    .use(XHRUpload, {
      endpoint: '/api/upload',
      formData: true,
      fieldName: 'file',
      headers: {
        'x-upload-path': `/private/events/${eventId}/photos`,
      },
    });
    
    uppy.on('complete', (result) => {
      uploadComplete.value = true;
      // Send metadata to /api/events/:eventId/photos
    });
  });
  
  return (
    <div>
      <div id="uppy-dashboard"></div>
      <button onClick$={initUppy}>Start Upload</button>
    </div>
  );
});
```

#### 2. Create `src/components/events/TicketScanner.tsx`

Browser-based QR scanner using html5-qrcode.

#### 3. Create `src/components/events/ParticipationToggle.tsx`

Yes/No/Maybe buttons with API integration.

#### 4. Create `src/components/events/PhotoGallery.tsx`

Lazy-loading photo grid with secure URL generation.

### Phase 4: Routes and Server Functions

#### 1. Admin Routes with Server Functions

**`src/routes/admin/events/[id]/scan/index.tsx`**:
```typescript
import { routeAction$, zod$ } from '@builder.io/qwik-city';
import { z } from 'zod';
import { ticketsService } from '~/services/tickets.service';

export const useScanTicket = routeAction$(async (data, { params, sharedMap }) => {
  const session = sharedMap.get('session');
  // Validate user is organizer, scan ticket
  return ticketsService.scanTicket(data.qrData, params.id, session.userId);
}, zod$({
  qrData: z.string().min(1),
}));
```

**`src/routes/admin/events/[id]/photos/index.tsx`**:
```typescript
import { routeAction$, zod$ } from '@builder.io/qwik-city';
import { z } from 'zod';
import { photosService } from '~/services/photos.service';

export const useCreatePhoto = routeAction$(async (data, { params, sharedMap }) => {
  const session = sharedMap.get('session');
  return photosService.createPhoto(params.id, data.filePath, session.userId);
}, zod$({
  filePath: z.string().startsWith('/private/events/').endsWith('.webp'),
  thumbnailPath: z.string().optional(),
}));
```

#### 2. Public Routes with Loaders and Actions

**`src/routes/events/[id]/index.tsx`** (EXTEND EXISTING):
```typescript
import { routeAction$, routeLoader$, zod$ } from '@builder.io/qwik-city';
import { z } from 'zod';
import { participationService } from '~/services/participation.service';

// NEW: Load participation status
export const useParticipationStatus = routeLoader$(async ({ params, sharedMap }) => {
  const session = sharedMap.get('session');
  if (!session) return null;
  return participationService.getStatus(session.userId, params.id);
});

// NEW: Update participation
export const useUpdateParticipation = routeAction$(async (data, { params, sharedMap }) => {
  const session = sharedMap.get('session');
  return participationService.updateStatus(session.userId, params.id, data.status);
}, zod$({
  status: z.enum(['yes', 'no', 'maybe']),
}));
```

**`src/routes/events/[id]/photos/index.tsx`** (NEW):
```typescript
import { routeLoader$, routeAction$, zod$ } from '@builder.io/qwik-city';
import { z } from 'zod';
import { photosService } from '~/services/photos.service';

// Load photos (attendees only)
export const useEventPhotos = routeLoader$(async ({ params, sharedMap, query }) => {
  const session = sharedMap.get('session');
  const page = parseInt(query.get('page') || '1');
  return photosService.getPhotosForAttendee(params.id, session.userId, page);
});

// Generate secure URL
export const useGeneratePhotoUrl = routeAction$(async (data, { sharedMap }) => {
  const session = sharedMap.get('session');
  return photosService.generateSecureUrl(data.photoId, session.userId);
}, zod$({
  photoId: z.string().uuid(),
}));
```

#### 3. API Routes (ONLY ONE NEEDED)

**`src/routes/api/photos/serve/index.ts`** (TRUE REST ENDPOINT):
```typescript
import type { RequestHandler } from '@builder.io/qwik-city';
import { validateSecureUrl } from '~/utils/secure-urls';
import fs from 'fs/promises';
import path from 'path';

export const onGet: RequestHandler = async ({ query, send }) => {
  const filePath = query.get('path');
  const exp = query.get('exp');
  const sig = query.get('sig');
  const uid = query.get('uid');
  
  if (!filePath || !exp || !sig || !uid) {
    return send(403, { success: false, error: 'Missing parameters' });
  }
  
  if (!validateSecureUrl(filePath, exp, sig, uid)) {
    return send(403, { success: false, error: 'Invalid or expired signature' });
  }
  
  const fullPath = path.join(process.cwd(), 'public', filePath);
  const fileBuffer = await fs.readFile(fullPath);
  
  return send(200, fileBuffer, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=3600',
  });
};
```

**No other API endpoints needed** - everything else uses Qwik server functions!

## Testing

### Unit Tests

```bash
# Test services
npm test src/services/tickets.service.test.ts
npm test src/services/photos.service.test.ts

# Test utilities
npm test src/utils/qr-code.test.ts
npm test src/utils/secure-urls.test.ts
```

### Integration Tests

```bash
# Test API endpoints
npm test src/routes/api/tickets/scan/index.test.ts
npm test src/routes/api/photos/serve/index.test.ts
```

### E2E Tests

```bash
# Test full flows
npm run test:e2e
```

## Deployment Checklist

- [ ] Database migrations applied to production
- [ ] Environment variables configured
- [ ] `/private/` directory created with proper permissions
- [ ] QR signing secret configured
- [ ] Photo URL signing secret configured
- [ ] Uppy.io CDN assets loaded (if not bundled)
- [ ] Test ticket scanning on mobile devices
- [ ] Test photo upload with large files
- [ ] Verify secure URL expiry works correctly

## Common Issues

### Issue: QR codes not scanning
**Solution**: Ensure QR payload is valid JSON and signature matches server-side generation.

### Issue: Photos not accessible
**Solution**: Verify user has `scannedAt` timestamp for the event. Check file permissions on `/private/` directory.

### Issue: Secure URLs expiring too quickly
**Solution**: Check server clock synchronization. Verify expiry calculation is using consistent timestamp format.

### Issue: Uppy upload fails
**Solution**: Verify `/api/upload` endpoint accepts `x-upload-path` header. Check file size limits.

## Next Steps

After core implementation:
1. Add thumbnail generation for photo gallery
2. Implement bulk ticket scanning mode
3. Add email notifications for attendance confirmation
4. Create analytics dashboard for participation trends
5. Add export functionality for attendee lists

## Support

Refer to:
- `/specs/002-event-participation-tracking/data-model.md` for schema details
- `/specs/002-event-participation-tracking/contracts/` for API contracts
- `/specs/002-event-participation-tracking/research.md` for technology decisions
