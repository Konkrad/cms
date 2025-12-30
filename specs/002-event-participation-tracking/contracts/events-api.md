# Server Function Contracts: Event Extensions

**Implementation**: Qwik server functions in admin event routes (NOT REST APIs)

## updateEventAction

**Location**: `src/routes/admin/events/[id]/edit/index.tsx` (EXTEND EXISTING)  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod) - NEW FIELDS ONLY

```typescript
{
  // Existing fields: title, body, startDate, endDate, etc.
  salesStartDate: z.string().datetime().nullable().optional(),
  salesEndDate: z.string().datetime().nullable().optional(),
}
```

**Validation**:
- If `salesStartDate` set: must be before `salesEndDate`
- If `salesEndDate` set: must be before or equal to `endDate`
- Current user must be event organizer

### Return Type

```typescript
{
  success: true,
  id: string,
  title: string,
  salesStartDate: string | null,
  salesEndDate: string | null,
  updatedAt: string
}
```

**Error**:
```typescript
{
  success: false,
  error: string // "Invalid sales period" | "Not authorized"
}
```

---

## getSalesStatusLoader

**Location**: `src/routes/events/[id]/checkout/index.tsx`  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)

### Return Type

**Sales active**:
```typescript
{
  salesActive: true,
  salesStartDate: string | null,
  salesEndDate: string | null
}
```

**Sales not active**:
```typescript
{
  salesActive: false,
  reason: string, // "Sales open on ..." | "Sales have closed"
  salesStartDate: string | null,
  salesEndDate: string | null
}
```

---

## getEventStatsLoader

**Location**: `src/routes/admin/events/[id]/details/index.tsx` (EXTEND EXISTING)  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)
- Session: Current user must be event organizer

### Return Type - EXTENDED

```typescript
{
  // Existing stats...
  totalTickets: number,
  freeTickets: number,        // NEW
  paidTickets: number,        // NEW
  attendedCount: number,      // NEW
  attendanceRate: number,     // NEW (percentage)
  participationYes: number,   // NEW
  participationMaybe: number, // NEW
  participationNo: number,    // NEW
  totalPhotos: number         // NEW
}
```

**Error**: Throws Qwik error (403 if not organizer)
