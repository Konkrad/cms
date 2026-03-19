-- Seed test data for Playwright E2E
-- Rows are marked with seeded_by='e2e' to allow idempotent cleanup.

-- DELETE previous e2e seeded rows (use with caution)
-- DELETE FROM users WHERE seeded_by = 'e2e';
-- DELETE FROM events WHERE seeded_by = 'e2e';
-- DELETE FROM groups WHERE seeded_by = 'e2e';
-- DELETE FROM login_tokens WHERE seeded_by = 'e2e';

-- INSERT a test admin user (adjust columns to your schema)
-- INSERT INTO users (id, email, name, role, seeded_by) VALUES ('e2e-admin', 'admin+e2e@example.com', 'E2E Admin', 'admin', 'e2e');

-- INSERT a sample event
-- INSERT INTO events (id, title, slug, capacity, seeded_by) VALUES ('e2e-event-1', 'E2E Event 1', 'e2e-event-1', 100, 'e2e');

-- INSERT a sample group owned by admin
-- INSERT INTO groups (id, name, owner_id, seeded_by) VALUES ('e2e-group-1', 'E2E Group 1', 'e2e-admin', 'e2e');

-- INSERT a sample invite (if your app has an invites table)
-- INSERT INTO invites (id, group_id, email, token, expires_at, seeded_by) VALUES ('e2e-invite-1', 'e2e-group-1', 'invitee+e2e@example.com', 'e2e-token-1', DATETIME('now', '+7 days'), 'e2e');

-- INSERT a login token template for fast auth (if app stores tokens)
-- INSERT INTO login_tokens (id, email, token, expires_at, seeded_by) VALUES ('e2e-token-1', 'admin+e2e@example.com', 'magic-token-e2e', DATETIME('now', '+7 days'), 'e2e');
