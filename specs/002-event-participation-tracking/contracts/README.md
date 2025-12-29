# Contracts Directory

**Purpose**: Define interfaces for all client-server interactions in the Event Participation Tracking feature.

## Important: Server Functions, Not REST APIs

**Despite the `-api.md` filename suffix, most contracts in this directory describe Qwik server functions, NOT REST APIs.**

This naming convention is historical and will be updated. The key distinction is:

- **Server Functions** (majority): TypeScript functions defined with `routeAction$()` and `routeLoader$()` in route files
- **REST APIs** (only one): Traditional HTTP endpoints in `/api/` directory

## Files

| File | Type | Description |
|------|------|-------------|
| `tickets-api.md` | Server Functions | Ticket scanning and details retrieval |
| `participation-api.md` | Server Functions | Participation status tracking (yes/no/maybe) |
| `photos-api.md` | **Mixed** | Photo metadata (server functions) + `/api/photos/serve` (REST) |
| `events-api.md` | Server Functions | Event sales period and statistics extensions |
| `products-api.md` | Server Functions | Product participant capacity extensions |

## Understanding the Contracts

### Server Function Contract Format

```typescript
// Function name and location
export const useScanTicket = routeAction$(...)

// Input schema (Zod validation)
{
  qrData: z.string().min(1),
  eventId: z.string().uuid(),
}

// Return type (TypeScript)
{
  success: true,
  ticketId: string,
  ...
}
```

### REST API Contract Format

```
GET /api/photos/serve?path=...&exp=...&sig=...

Response:
Content-Type: image/webp
<binary data>
```

## Why This Matters

**For Implementers**:
- Read the "Location" field to understand where code goes
- `routeAction$` / `routeLoader$` → Add to existing route file
- `/api/...` → Create new API endpoint file

**For Consumers**:
- Server functions: Call via Qwik hooks (`const action = useScanTicket(); await action.submit(...)`)
- REST APIs: Call via fetch or `<img src="...">` for binary data

**For Reviewers**:
- Verify server functions use session context, not manual auth
- Verify REST APIs only used for binary data or external access
- Check type safety flows through server functions

## Migration from REST API Mindset

If you're familiar with REST APIs, here's the mental model shift:

| REST API | Server Function |
|----------|----------------|
| POST /api/tickets/scan | `routeAction$()` in scan route |
| GET /api/events/:id/photos | `routeLoader$()` in photos route |
| Authorization header | `sharedMap.get('session')` |
| JSON response | TypeScript return value |
| Manual validation | `zod$()` wrapper |
| Separate file in /api/ | Colocated with route |

## Architecture Document

For a detailed explanation of why this architecture was chosen, see [ARCHITECTURE.md](../ARCHITECTURE.md).

## Contract Status

✅ All contracts updated to reflect server function architecture (2025-12-29)  
✅ Only `/api/photos/serve` documented as true REST endpoint  
✅ Location fields specify exact route file paths  
✅ Type signatures use TypeScript, not JSON
