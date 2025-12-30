# Server Function Contracts: Participation Status

**Implementation**: Qwik server functions in route files (NOT REST APIs)

## updateParticipationAction

**Location**: `src/routes/events/[id]/index.tsx`  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod)

```typescript
{
  status: z.enum(['yes', 'no', 'maybe'])
}
```

**Validation**:
- Current user must be authenticated (from session)
- `eventId` from route parameter
- For paid events: 'yes' only allowed if user has purchased ticket
- For free events: 'yes' creates free ticket automatically

### Return Type

**Success**:
```typescript
{
  success: true,
  userId: string,
  eventId: string,
  status: 'yes' | 'no' | 'maybe',
  updatedAt: string // ISO 8601
}
```

**Error (paid event without ticket)**:
```typescript
{
  success: false,
  error: "Cannot indicate 'yes' for paid event without ticket purchase"
}
```

---

## getParticipationStatusLoader

**Location**: `src/routes/events/[id]/index.tsx`  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)
- Session: Current user ID

### Return Type

**Status exists**:
```typescript
{
  status: 'yes' | 'no' | 'maybe',
  updatedAt: string // ISO 8601
}
```

**No status set**:
```typescript
null
```

---

## getParticipationSummaryLoader

**Location**: `src/routes/admin/events/[id]/details/index.tsx`  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)
- Session: Current user must be event organizer

### Return Type

```typescript
{
  yes: number,
  no: number,
  maybe: number,
  total: number
}
```

**Error**: Throws Qwik error (403 if not organizer)
