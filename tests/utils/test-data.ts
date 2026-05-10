import Database from 'better-sqlite3';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export async function createEventWithInventory(opts: {
  title: string;
  startOffsetDays: number;
  durationHours?: number;
  city?: string;
  country?: string;
  groupSlug?: string | null;
  products?: Array<{
    name: string;
    price: number;
    maxQuantity: number;
    soldQuantity?: number;
  }>;
  salesStartOffset?: number | null;
  salesEndOffset?: number | null;
  needsTicket?: boolean;
}, useServicesForProducts = true) {
  const db = new Database('./my-database.db');
  try {
    // Find an admin user as organizer
    const admin = db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .get() as { id: string } | undefined;
    const adminId = admin?.id;

    // Find group id if provided
    let groupId: string | null = null;
    if (opts.groupSlug) {
      const g = db
        .prepare('SELECT id FROM groups WHERE slug = ? LIMIT 1')
        .get(opts.groupSlug) as { id: string } | undefined;
      if (g) groupId = g.id;
    }

    // Create event using the app service
    const { eventsService } = await import('../../src/services/events.service');

    const start = daysFromNow(opts.startOffsetDays);
    const end = new Date(new Date(start).getTime() + (opts.durationHours ?? 2) * 3600000).toISOString();

    const ev = await eventsService.create({
      title: opts.title,
      body: `<p>Auto-created event ${opts.title}</p>`,
      startDate: start,
      endDate: end,
      locationType: opts.city === 'Online' ? 'online' : 'in-person',
      address: opts.city === 'Online' ? '' : (opts.city || '') + ' address',
      city: opts.city || null,
      country: opts.country || null,
      longitude: opts.city ? '0' : null,
      latitude: opts.city ? '0' : null,
      onlineUrl: opts.city === 'Online' ? 'https://meet.example.com' : null,
      userId: adminId,
      groupId,
      visibility: 'global',
    } as any);

    // If no products requested, return the event
    if (!opts.products || opts.products.length === 0) {
      return ev;
    }

    // Create an inventory group
    const { inventoryGroupsService } = await import('../../src/services/inventory-groups.service');
    const inv = await inventoryGroupsService.create({
      eventId: ev.id,
      name: `${opts.title} Inventory`,
      maxCapacity: opts.products.reduce((s, p) => s + p.maxQuantity, 0) || 10,
      needsTicket: opts.needsTicket === undefined ? true : opts.needsTicket,
      salesStartDate: opts.salesStartOffset != null ? daysFromNow(opts.salesStartOffset) : undefined,
      salesEndDate: opts.salesEndOffset != null ? daysFromNow(opts.salesEndOffset) : undefined,
      createdAt: new Date().toISOString(),
    } as any);

    // Create products
    if (useServicesForProducts) {
      const { productsService } = await import('../../src/services/products.service');
      const created: any[] = [];
      for (const p of opts.products) {
        const prod = await productsService.create({
          eventId: ev.id,
          inventoryGroupId: inv.id,
          name: p.name,
          price: p.price,
          maxQuantity: p.maxQuantity,
          participantCapacity: 1,
          features: [],
        } as any);
        // Optionally set soldQuantity directly in DB for sold-out scenarios
        if (p.soldQuantity) {
          db.prepare('UPDATE products SET sold_quantity = ? WHERE id = ?').run(p.soldQuantity, prod.id);
        }
        created.push(prod);
      }
      return ev;
    }

    // Fallback: insert products directly
    for (const p of opts.products) {
      const id = require('crypto').randomUUID();
      db.prepare(`INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features, image_url, stripe_product_id, sold_quantity, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id,
        ev.id,
        inv.id,
        p.name,
        p.price,
        p.maxQuantity,
        1,
        JSON.stringify([]),
        null,
        null,
        p.soldQuantity || 0,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    }

    return ev;
  } finally {
    db.close();
  }
}

export default { createEventWithInventory };
