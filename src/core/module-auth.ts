import { requireAuth } from "~/core/auth/server-auth";
import { requireActiveModule } from "./registry/manifests";

/**
 * Login check plus module switch for public module loaders/actions: redirects to `/login`
 * when logged out, then 404s when the module is inactive. Returns the user. Call as the first
 * statement, before any try block.
 */
export async function requireModuleAuth(
	event: Parameters<typeof requireAuth>[0],
	module: string,
) {
	const user = await requireAuth(event);
	requireActiveModule(event, module);
	return user;
}
