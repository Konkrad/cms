import { coreNotifications } from "~/core/notifications/core-notifications";
import {
	indexNotifications,
	type NotificationDefinition,
} from "~/core/notifications/define";
import { type ModuleDefinition, notificationsOf } from "~/core/router/modules";
import { activeModules, allModules } from "./manifests";

/** Core definitions plus those of the given modules, by id. Throws on a duplicate id. */
export const buildNotificationRegistry = (
	core: readonly NotificationDefinition[],
	modules: readonly ModuleDefinition[],
) => indexNotifications([...core, ...notificationsOf(modules)]);

/**
 * Every registered module, not only the active ones: rows queued before a module was
 * deactivated (or by its payment handlers, which run while inactive) must still be sent.
 */
const registry = buildNotificationRegistry(coreNotifications, allModules);

export const getNotificationDefinition = (
	id: string,
): NotificationDefinition | undefined => registry.get(id);

/** Optional notifications of core and the active modules (what a user can mute in the profile). */
export const activeOptionalNotifications = (): NotificationDefinition[] =>
	[...coreNotifications, ...notificationsOf(activeModules)].filter(
		(def) => def.optional,
	);
