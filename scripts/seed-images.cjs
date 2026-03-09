const Database = require("better-sqlite3");
const db = new Database("my-database.db");

const BASE = "http://localhost:9000/data/public/events/";
const imgs = [
  "1ca6d59d-64fe-4ad2-aa48-e4d7fb693121.webp",
  "604eba88-a38e-4325-80a0-1d8646a96a59.webp",
  "1707077845237.webp",
  "Photo%27s%20in%20detail.webp",
];
const urls = imgs.map((f) => BASE + f);
console.log("Available image URLs:");
urls.forEach((u, i) => console.log(i, u));

// Events without images
const events = db
  .prepare(
    "SELECT id, title FROM events WHERE deleted_at IS NULL AND (image1 IS NULL OR image2 IS NULL)",
  )
  .all();
console.log("\nUpdating", events.length, "events...");
const updateEvent = db.prepare(
  "UPDATE events SET image1 = ?, image2 = ? WHERE id = ?",
);
events.forEach((e, i) => {
  const img1 = urls[i % urls.length];
  const img2 = urls[(i + 1) % urls.length];
  updateEvent.run(img1, img2, e.id);
  console.log(
    " event:",
    e.title,
    "->",
    img1.split("/").pop(),
    img2.split("/").pop(),
  );
});

// Posts without featured_image
const posts = db
  .prepare(
    "SELECT id, title FROM posts WHERE deleted_at IS NULL AND featured_image IS NULL",
  )
  .all();
console.log("\nUpdating", posts.length, "posts...");
const updatePost = db.prepare(
  "UPDATE posts SET featured_image = ? WHERE id = ?",
);
posts.forEach((p, i) => {
  const img = urls[i % urls.length];
  updatePost.run(img, p.id);
  console.log(" post:", p.title, "->", img.split("/").pop());
});

// Groups without images
const groups = db
  .prepare(
    "SELECT id, name FROM groups WHERE image1 IS NULL OR image2 IS NULL OR image3 IS NULL",
  )
  .all();
console.log("\nUpdating", groups.length, "groups...");
const updateGroup = db.prepare(
  "UPDATE groups SET image1 = ?, image2 = ?, image3 = ? WHERE id = ?",
);
groups.forEach((g, i) => {
  const img1 = urls[i % urls.length];
  const img2 = urls[(i + 1) % urls.length];
  const img3 = urls[(i + 2) % urls.length];
  updateGroup.run(img1, img2, img3, g.id);
  console.log(
    " group:",
    g.name,
    "->",
    img1.split("/").pop(),
    img2.split("/").pop(),
    img3.split("/").pop(),
  );
});

console.log("\nDone.");
