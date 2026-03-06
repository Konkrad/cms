import { db } from "../src/db/connection";
import { users } from "../src/db/schemas/users";
import { events } from "../src/db/schemas/events";
import { participationStatus } from "../src/db/schemas/participation-status";
import crypto from "crypto";

const createTestData = async () => {
  console.log("Creating test data...");

  // 1. Create a Host User
  const hostId = crypto.randomUUID();
  console.log(`Creating host user with ID: ${hostId}`);
  await db.insert(users).values({
    id: hostId,
    name: "Host",
    familyName: "User",
    displayName: "Host User",
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 2. Create an Event
  const eventId = crypto.randomUUID();
  console.log(`Creating event with ID: ${eventId}`);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // 1 week from now
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 2);

  await db.insert(events).values({
    id: eventId,
    title: "Test Meetup Event",
    body: "This is a generated test event for testing participation.",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    locationType: "offline",
    address: "123 Test St",
    city: "Test City",
    country: "Testland",
    userId: hostId, // Created by host
    visibility: "global",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 3. Create Participants
  const participantCount = 10;
  console.log(`Creating ${participantCount} participants...`);

  for (let i = 0; i < participantCount; i++) {
    const userId = crypto.randomUUID();
    const firstName = `User${i + 1}`;
    const lastName = "Test";

    await db.insert(users).values({
      id: userId,
      name: firstName,
      familyName: lastName,
      displayName: `${firstName} ${lastName}`,
      role: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Add Participation Status
    // Mix of yes, no, maybe
    const statuses = ["yes", "no", "maybe"] as const;
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    await db.insert(participationStatus).values({
      id: crypto.randomUUID(),
      userId: userId,
      eventId: eventId,
      status: status,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log("Test data created successfully!");
};

createTestData().catch((err) => {
  console.error("Error creating test data:", err);
  process.exit(1);
});
