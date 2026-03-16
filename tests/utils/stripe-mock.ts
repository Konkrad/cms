import { spawn } from 'child_process';

let proc: ReturnType<typeof spawn> | null = null;

async function isStripeMockRunning(port: number) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://localhost:${port}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function startStripeMock(port = 12111) {
  if (proc) return proc;
  if (await isStripeMockRunning(port)) return null;

  proc = spawn('npx', ['stripe-mock', '--port', String(port)], { stdio: 'ignore' });
  return proc;
}

export function stopStripeMock() {
  if (!proc) return;
  proc.kill();
  proc = null;
}
