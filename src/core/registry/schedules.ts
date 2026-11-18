import type { ModuleDefinition } from "~/core/router/modules";
import { coreSchedules } from "~/core/scheduler/core-schedules";
import {
	type RegisteredSchedule,
	registerSchedules,
} from "~/core/scheduler/define";
import { activeModules } from "./manifests";

/**
 * Schedules of core and the ACTIVE modules only (spec 4.1: an inactive module adds no
 * scheduled jobs). Keyed `<owner>.<id>`.
 */
export const buildSchedules = (
	modules: ReadonlyArray<Pick<ModuleDefinition, "id" | "schedules">>,
) => registerSchedules([{ id: "core", schedules: coreSchedules }, ...modules]);

const schedules = buildSchedules(activeModules);

export const activeSchedules = (): RegisteredSchedule[] => schedules;
