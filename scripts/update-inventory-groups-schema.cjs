const Database = require('better-sqlite3');
const db = new Database('my-database.db');
try {
  const cols = db.prepare("PRAGMA table_info('inventory_groups')").all();
  const names = cols.map(r => r.name);
  if (!names.includes('sales_start_date')) {
    db.exec("ALTER TABLE inventory_groups ADD COLUMN sales_start_date TEXT;");
    console.log('Added column sales_start_date');
  } else {
    console.log('sales_start_date already exists');
  }
  if (!names.includes('sales_end_date')) {
    db.exec("ALTER TABLE inventory_groups ADD COLUMN sales_end_date TEXT;");
    console.log('Added column sales_end_date');
  } else {
    console.log('sales_end_date already exists');
  }
  db.exec("CREATE INDEX IF NOT EXISTS inventory_groups_sales_start_idx ON inventory_groups (sales_start_date);");
  db.exec("CREATE INDEX IF NOT EXISTS inventory_groups_sales_end_idx ON inventory_groups (sales_end_date);");
  console.log('Indexes ensured');
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  db.close();
}
