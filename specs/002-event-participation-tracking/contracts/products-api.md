# Server Function Contracts: Product Extensions

**Implementation**: Qwik server functions in admin product routes (NOT REST APIs)

## createProductAction

**Location**: `src/routes/admin/events/[id]/products/index.tsx` (EXTEND EXISTING)  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod) - NEW FIELD ONLY

```typescript
{
  // Existing fields: eventId, inventoryGroupId, name, price, maxQuantity, features, imageUrl
  participantCapacity: z.number().int().min(1).default(1).optional(),
}
```

**Validation**:
- Current user must be event organizer
- `participantCapacity` defaults to 1 if not provided

### Return Type

```typescript
{
  success: true,
  id: string,
  name: string,
  price: number,
  participantCapacity: number,
  createdAt: string
}
```

---

## updateProductAction

**Location**: `src/routes/admin/events/[id]/products/index.tsx` (EXTEND EXISTING)  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod) - NEW FIELD ONLY

```typescript
{
  // Existing fields: name, price, maxQuantity, features, imageUrl
  participantCapacity: z.number().int().min(1).optional(),
}
```

**Validation**:
- Current user must be event organizer
- Cannot decrease capacity below existing ticket participant counts

### Return Type

```typescript
{
  success: true,
  id: string,
  name: string,
  participantCapacity: number,
  updatedAt: string
}
```

**Error**:
```typescript
{
  success: false,
  error: "Cannot reduce capacity below existing participant count"
}
```

---

## getProductLoader

**Location**: `src/routes/events/[id]/checkout/index.tsx` (EXTEND EXISTING)  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)
- Query parameter: `productId` (UUID)

### Return Type - EXTENDED

```typescript
{
  id: string,
  eventId: string,
  name: string,
  price: number,
  maxQuantity: number,
  soldQuantity: number,
  availableQuantity: number,
  features: string[],
  imageUrl: string | null,
  participantCapacity: number,          // NEW
  requiresParticipantData: boolean      // NEW (computed: participantCapacity > 1)
}
```
