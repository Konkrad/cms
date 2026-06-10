import os from "os";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Pick only real hardware/wireless interfaces (en*, eth*, wl*), not VMs/VPNs
const ifaces = os.networkInterfaces();
const ip = Object.entries(ifaces)
  .filter(([name]) => /^(en|eth|wl)\d/i.test(name))
  .flatMap(([, addrs]) => addrs)
  .find((n) => n.family === "IPv4" && !n.internal)
  ?.address;

// Read the MinIO port from .env (default 9000)
const root = dirname(dirname(fileURLToPath(import.meta.url)));
let minioPort = 9000;
try {
  const env = readFileSync(resolve(root, ".env"), "utf8");
  const match = env.match(/AWS_ENDPOINT=https?:\/\/[^:]+:(\d+)/);
  if (match) minioPort = parseInt(match[1], 10);
} catch {}

const url = ip ? `http://${ip}:5173` : "http://localhost:5173";
const padded = `  ${url}  `.padEnd(41);
console.log("\n┌─────────────────────────────────────┐");
console.log("│  Dev server starting on:              │");
console.log("│                                       │");
console.log(`│${padded}│`);
console.log("│                                       │");
console.log("└─────────────────────────────────────┘\n");

// Override AWS_ENDPOINT so image redirects point to the network IP, not localhost.
// MinIO is already bound to 0.0.0.0 via Docker — it just needs the right public address.
const extraEnv = ip
  ? { AWS_ENDPOINT: `http://${ip}:${minioPort}` }
  : {};

const vite = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "--mode", "ssr", "--host", "0.0.0.0"],
  { stdio: "inherit", env: { ...process.env, ...extraEnv } }
);

vite.on("exit", (code) => process.exit(code ?? 0));
