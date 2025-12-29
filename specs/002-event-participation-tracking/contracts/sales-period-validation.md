# API Contract: Sales Period Validation

**Endpoint**: GET `/api/events/{eventId}/inventory/{inventoryGroupId}/availability`  
**Purpose**: Check if products in inventory group are available for purchase based on sales period

## Request

### Path Parameters
- `eventId` (string, UUID): Event identifier
- `inventoryGroupId` (string, UUID): Inventory group identifier

### Headers
```
Content-Type: application/json
```

### Validation Rules
- Event must exist
- Inventory group must belong to specified event

## Response

### Success (200 OK) - Sales Open
```json
{
  "success": true,
  "data": {
    "available": true,
    "inventoryGroup": {
      "id": "string (UUID)",
      "name": "string",
      "salesStartDate": "string (ISO 8601)" | null,
      "salesEndDate": "string (ISO 8601)" | null,
      "maxCapacity": 100,
      "soldQuantity": 45,
      "remainingCapacity": 55
    },
    "message": "Sales are open"
  }
}
```

### Success (200 OK) - Sales Not Started
```json
{
  "success": true,
  "data": {
    "available": false,
    "inventoryGroup": {
      "id": "string (UUID)",
      "name": "string (Early Bird)",
      "salesStartDate": "2024-02-01T00:00:00Z",
      "salesEndDate": "2024-04-01T00:00:00Z",
      "maxCapacity": 100,
      "soldQuantity": 0,
      "remainingCapacity": 100
    },
    "reason": "not_started",
    "message": "Sales open on February 1, 2024"
  }
}
```

### Success (200 OK) - Sales Ended
```json
{
  "success": true,
  "data": {
    "available": false,
    "inventoryGroup": {
      "id": "string (UUID)",
      "name": "string (Early Bird)",
      "salesStartDate": "2024-02-01T00:00:00Z",
      "salesEndDate": "2024-04-01T00:00:00Z",
      "maxCapacity": 100,
      "soldQuantity": 85,
      "remainingCapacity": 15
    },
    "reason": "ended",
    "message": "Sales ended on April 1, 2024"
  }
}
```

### Success (200 OK) - Sold Out
```json
{
  "success": true,
  "data": {
    "available": false,
    "inventoryGroup": {
      "id": "string (UUID)",
      "name": "string",
      "salesStartDate": null,
      "salesEndDate": null,
      "maxCapacity": 100,
      "soldQuantity": 100,
      "remainingCapacity": 0
    },
    "reason": "sold_out",
    "message": "No tickets remaining"
  }
}
```

### Error Responses

#### 404 Not Found - Event Doesn't Exist
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### 404 Not Found - Inventory Group Doesn't Exist
```json
{
  "success": false,
  "error": "Inventory group not found"
}
```

## Business Logic

1. **Inventory Group Query**:
   - SELECT salesStartDate, salesEndDate, maxCapacity FROM inventory_groups WHERE id = ?
   - Verify eventId matches

2. **Capacity Check**:
   - Calculate soldQuantity: SUM of products.soldQuantity in this group
   - remainingCapacity = maxCapacity - soldQuantity
   - If remainingCapacity <= 0: Return sold_out

3. **Sales Period Validation** (only if not sold out):
   - Current time: `NOW()` (server timestamp, UTC)
   - If `salesStartDate` IS NOT NULL AND `NOW() < salesStartDate`: Return not_started
   - If `salesEndDate` IS NOT NULL AND `NOW() > salesEndDate`: Return ended
   - Otherwise: Return available = true

4. **Message Generation**:
   - Format dates in user-friendly format
   - Include timezone information if needed
   - Countdown timer data can be calculated client-side from returned dates

## Usage

This endpoint is called:
- When displaying event/product page (to show/hide purchase buttons)
- Before initiating checkout (final validation)
- By admin UI to show current sales status

## Rate Limiting
- 120 requests per minute per IP (high traffic expected on event pages)

## Notes
- If both salesStartDate and salesEndDate are NULL, sales are always open (within event lifecycle)
- Server timestamp is authoritative (client cannot bypass by changing local time)
- Sold out takes precedence over sales period (even if sales window is open)
- Inventory group can have products in different states, but availability applies to entire group
