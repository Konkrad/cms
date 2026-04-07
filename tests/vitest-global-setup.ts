/**
 * Vitest global setup — spins up testcontainers (mailpit, minio, stripe-mock)
 * and creates an isolated SQLite test database with the current schema applied.
 *
 * All ports and the temp DB path are written into process.env so that
 * src/env.ts and src/db/connection.ts pick them up when first imported in
 * each test worker.
 */

import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

let mailpit: StartedTestContainer;
let minio: StartedTestContainer;
let stripeMock: StartedTestContainer;
let tmpDbPath: string;

export async function setup() {
  // ── 1. Isolated test database ─────────────────────────────────────────────
  tmpDbPath = path.join(os.tmpdir(), `cms-test-${Date.now()}.db`);
  process.env.DB_PATH = tmpDbPath;
  // Push the current Drizzle schema into the blank temp DB.
  execSync("npx drizzle-kit push --force", {
    env: { ...process.env, DB_PATH: tmpDbPath },
    stdio: "pipe",
  });

  // ── 2. Required env vars (non-container) ──────────────────────────────────
  process.env.NODE_ENV = "test";
  process.env.APP_URL ??= "http://localhost:5173";
  process.env.APP_NAME ??= "Test App";
  process.env.MAGIC_LINK_SECRET ??= "vitest-test-secret-not-for-production";
  process.env.TELEGRAM_BOT_TOKEN ??= "0:dummy";
  process.env.TELEGRAM_CHANNEL_ID ??= "0";
  process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ??= "pk.dummy";

  // ── 3. Containers ─────────────────────────────────────────────────────────
  [mailpit, minio, stripeMock] = await Promise.all([
    // mailpit: SMTP (1025) + HTTP API (8025)
    new GenericContainer("axllent/mailpit")
      .withExposedPorts(1025, 8025)
      .withEnvironment({
        MP_SMTP_AUTH_ACCEPT_ANY: "1",
        MP_SMTP_AUTH_ALLOW_INSECURE: "1",
      })
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),

    // minio: S3-compatible storage
    new GenericContainer("minio/minio")
      .withExposedPorts(9000)
      .withEnvironment({
        MINIO_ROOT_USER: "test",
        MINIO_ROOT_PASSWORD: "testtest",
      })
      .withCommand(["server", "/data"])
      .withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
      .start(),

    // stripe-mock: Stripe API responses
    new GenericContainer("stripe/stripe-mock")
      .withExposedPorts(12111)
      .withCommand(["stripe-mock", "--port", "12111"])
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);

  // ── 4. Inject container addresses ─────────────────────────────────────────
  const smtpPort = mailpit.getMappedPort(1025);
  const mailpitApiPort = mailpit.getMappedPort(8025);
  const minioPort = minio.getMappedPort(9000);
  const stripePort = stripeMock.getMappedPort(12111);

  process.env.SMTP_HOST = "localhost";
  process.env.SMTP_PORT = String(smtpPort);
  process.env.SMTP_FROM = "test@example.com";
  process.env.MAILPIT_API_URL = `http://localhost:${mailpitApiPort}`;

  process.env.AWS_ENDPOINT = `http://localhost:${minioPort}`;
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "testtest";
  process.env.AWS_REGION = "us-east-1";
  process.env.S3_BUCKET = "test-bucket";

  process.env.STRIPE_API_BASE_URL = `http://localhost:${stripePort}`;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
}

export async function teardown() {
  await Promise.allSettled([
    mailpit?.stop(),
    minio?.stop(),
    stripeMock?.stop(),
  ]);

  if (tmpDbPath && fs.existsSync(tmpDbPath)) {
    fs.unlinkSync(tmpDbPath);
  }
}
