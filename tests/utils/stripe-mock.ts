import { spawn } from 'child_process';
let proc = null;
export function startStripeMock(port = 12111) {
  if (proc) return proc;
  proc = spawn('npx', ['stripe-mock', '--port', String(port)], { stdio: 'ignore' });
  return proc;
}
export function stopStripeMock() {
  if (!proc) return;
  proc.kill();
  proc = null;
}