# Architecture: Server Functions vs REST APIs

**Date**: 2025-12-29  
**Context**: Clarification on implementation approach for Event Participation Tracking feature

## Key Distinction

This feature primarily uses **Qwik server functions**, not REST APIs. This is a critical architectural decision that impacts how the code is structured.

## What are Qwik Server Functions?

Qwik server functions are TypeScript functions that:
- Run on the server but are called like normal functions from client components
- Automatically serialize/deserialize data between client and server
- Integrate with Qwik's session and context systems
- Provide type safety across the client-server boundary
- Are defined using `routeAction$()` for mutations and `routeLoader$()` for queries

**Example**:
```typescript
// In route file: src/routes/events/[id]/index.tsx
export const useUpdateParticipation = routeAction$(async (data, { params, sharedMap }) => {
  const session = sharedMap.get('session');
  return participationService.updateStatus(session.userId, params.id, data.status);
}, zod$({
  status: z.enum(['yes', 'no', 'maybe']),
}));

// In component:
const updateAction = useUpdateParticipation();
await updateAction.submit({ status: 'yes' }); // Looks like a function call!
```

## REST APIs vs Server Functions

| Aspect | REST API | Qwik Server Function |
|--------|----------|---------------------|
| **Definition** | Separate endpoint in `/api/` | Colocated with route/component |
| **Type Safety** | Manual types, can drift | Automatic inference |
| **Session Access** | Manual token parsing | Built-in `sharedMap.get('session')` |
| **Validation** | Manual or separate middleware | `zod$()` validator inline |
| **Response Format** | JSON or custom | Auto-serialized TypeScript types |
| **Use Case** | External APIs, binary data | Internal app communication |

## This Feature's Implementation

### Using Server Functions (NOT REST APIs)

1. **Ticket Scanning**
   - ❌ NOT: `POST /api/tickets/scan`
   - ✅ YES: `routeAction$()` in `src/routes/admin/events/[id]/scan/index.tsx`
   - Why: Form submission with session context, Zod validation

2. **Participation Status**
   - ❌ NOT: `POST /api/events/:id/participation` + `GET /api/events/:id/participation`
   - ✅ YES: `routeAction$()` + `routeLoader$()` in `src/routes/events/[id]/index.tsx`
   - Why: State management with user session, SSR integration

3. **Photo Metadata Creation**
   - ❌ NOT: `POST /api/events/:id/photos`
   - ✅ YES: `routeAction$()` in `src/routes/admin/events/[id]/photos/index.tsx`
   - Why: Form submission after Uppy upload, organizer validation

4. **Photo Gallery Loading**
   - ❌ NOT: `GET /api/events/:id/photos`
   - ✅ YES: `routeLoader$()` in `src/routes/events/[id]/photos/index.tsx`
   - Why: SSR data loading, attendance verification

5. **Secure URL Generation**
   - ❌ NOT: `GET /api/photos/:id/secure-url`
   - ✅ YES: `routeAction$()` in photo route
   - Why: User-specific HMAC signing with session

### Using REST API (ONLY ONE)

6. **Photo File Serving**
   - ✅ YES: `GET /api/photos/serve?path=...&exp=...&sig=...&uid=...`
   - Why: Must serve **binary image data**, not JSON
   - Why: Must work with standard HTML `<img src="...">` tags
   - Why: HMAC validation without session state (stateless verification)
   - Why: Cache headers for browser optimization

## Existing Pattern in Codebase

The current ticket system **already uses this pattern**:
- Ticket checkout: `routeAction$()` in checkout route (NOT REST API)
- Ticket listing: `routeLoader$()` in profile route (NOT REST API)
- Transaction processing: Server functions with Stripe integration

This feature extends the existing pattern consistently.

## Benefits

1. **Type Safety**: TypeScript types flow automatically from server to client
2. **Less Boilerplate**: No need to define API routes, parse requests, format responses
3. **Session Integration**: Automatic access to user session without token management
4. **Validation**: Zod schemas inline with action definitions
5. **Code Locality**: Route logic stays with the route, not scattered in `/api/`
6. **Smaller API Surface**: Only expose REST endpoints when truly needed (external access, binary data)

## Migration Notes

If you see references to REST API endpoints in old documentation or contracts:
- Assume they should be server functions unless explicitly marked
- Check if the operation returns JSON → server function
- Check if the operation needs session context → server function
- Check if the operation serves binary data → REST API
- Check if the operation needs external access (webhooks) → REST API

## Contract Files Updated

The contract files in `/contracts/` have been updated to reflect:
- Server function signatures (input schemas, return types)
- Location in route files (not `/api/` endpoints)
- Proper use of `routeAction$` and `routeLoader$`
- Only `/api/photos/serve` documented as REST endpoint
