import { afterAll, describe, expect, it } from "vitest";
import { buildSchedules } from "~/core/registry/schedules";
import { selectActive } from "~/core/router/modules";
import {
	everyMs,
	type RegisteredSchedule,
	registerSchedules,
} from "~/core/scheduler/define";
import { scheduleRunsService } from "~/core/scheduler/schedule-runs.service";
import { runDueSchedules, SCHEDULE_LEASE_MS } from "~/core/scheduler/scheduler";
import { openDb } from "./helpers";

const tag = Date.now().toString(36);
const keys: string[] = [];

function schedule(
	id: string,
	every: number,
	run: () => Promise<void>,
): RegisteredSchedule {
	const key = `test-${tag}.${id}`;
	keys.push(key);
	return { key, everyMs: every, run };
}

afterAll(() => {
	const db = openDb();
	for (const key of keys)
		db.prepare("DELETE FROM schedule_runs WHERE key = ?").run(key);
	db.close();
});

const HOUR = 3_600_000;
const t0 = new Date("2026-01-01T00:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("intervals and registration", () => {
	it("parses every", () => {
		expect(everyMs("1d")).toBe(86_400_000);
		expect(everyMs("15m")).toBe(900_000);
		expect(everyMs(5000)).toBe(5000);
		expect(() => everyMs("0h" as never)).toThrow();
		expect(() => everyMs("daily" as never)).toThrow();
	});

	it("keys schedules by owner and rejects duplicates", () => {
		const run = async () => {};
		expect(
			registerSchedules([
				{ id: "events", schedules: [{ id: "a", every: "1h", run }] },
			]).map((s) => s.key),
		).toEqual(["events.a"]);
		expect(() =>
			registerSchedules([
				{
					id: "events",
					schedules: [
						{ id: "a", every: "1h", run },
						{ id: "a", every: "1d", run },
					],
				},
			]),
		).toThrow(/Duplicate/);
	});

	it("only active modules' schedules are registered", () => {
		const run = async () => {};
		const modules = [
			{ id: "on", schedules: [{ id: "x", every: "1h" as const, run }] },
			{ id: "off", schedules: [{ id: "y", every: "1h" as const, run }] },
		];
		const active = selectActive(modules as never, ["on"]);
		expect(buildSchedules(active).map((s) => s.key)).toEqual(["on.x"]);
	});
});

describe("runDueSchedules", () => {
	it("runs a due schedule once per interval, across ticks", async () => {
		let runs = 0;
		const s = schedule("once", HOUR, async () => {
			runs++;
		});
		expect((await runDueSchedules([s], t0)).ran).toEqual([s.key]);
		await runDueSchedules([s], at(1000));
		await runDueSchedules([s], at(HOUR - 1));
		expect(runs).toBe(1);
		await runDueSchedules([s], at(HOUR));
		expect(runs).toBe(2);
	});

	it("never runs twice when two ticks race (two processes)", async () => {
		let runs = 0;
		let release: () => void = () => {};
		const s = schedule("race", HOUR, async () => {
			runs++;
			await new Promise<void>((r) => {
				release = r;
			});
		});
		const first = runDueSchedules([s], t0);
		// Give the first tick time to claim and start running.
		await new Promise((r) => setTimeout(r, 50));
		const second = await runDueSchedules([s], at(10));
		release();
		await first;
		expect(runs).toBe(1);
		expect(second.ran).toEqual([]);
	});

	it("a stale lease (crashed process) is taken over", async () => {
		let runs = 0;
		const s = schedule("stale", HOUR, async () => {
			runs++;
		});
		await scheduleRunsService.ensure([s.key], t0);
		expect(await scheduleRunsService.claim(s.key, t0, SCHEDULE_LEASE_MS)).toBe(
			true,
		);
		await runDueSchedules([s], at(1000));
		expect(runs).toBe(0);
		await runDueSchedules([s], at(SCHEDULE_LEASE_MS + 1));
		expect(runs).toBe(1);
	});

	it("records a failure, retries after a backoff (not every tick) and lists it", async () => {
		let runs = 0;
		const s = schedule("fails", HOUR, async () => {
			runs++;
			if (runs < 3) throw new Error(`boom ${runs}`);
		});
		expect((await runDueSchedules([s], t0)).failed).toEqual([s.key]);
		let row = await scheduleRunsService.get(s.key);
		expect(row?.lastStatus).toBe("failed");
		expect(row?.lastError).toBe("boom 1");
		expect(row?.failures).toBe(1);
		expect(
			(await scheduleRunsService.listFailing()).map((r) => r.key),
		).toContain(s.key);
		await runDueSchedules([s], at(30_000));
		expect(runs).toBe(1);
		await runDueSchedules([s], at(60_000));
		expect(runs).toBe(2);
		row = await scheduleRunsService.get(s.key);
		expect(row?.failures).toBe(2);
		// Second retry waits 2 minutes.
		await runDueSchedules([s], at(60_000 + 119_000));
		expect(runs).toBe(2);
		await runDueSchedules([s], at(60_000 + 120_000));
		expect(runs).toBe(3);
		row = await scheduleRunsService.get(s.key);
		expect(row?.lastStatus).toBe("ok");
		expect(row?.failures).toBe(0);
		expect(
			(await scheduleRunsService.listFailing()).map((r) => r.key),
		).not.toContain(s.key);
	});
});
