import type { BirthPeriodChoice } from "~/contracts/users";
import {
	birthPeriodLabel,
	birthPeriodOptions,
	birthPeriodStart,
} from "~/core/users/birth-period";
import { env } from "~/env";

/**
 * The viewer's OWN birth period for their profile page, read at the site's period length, and
 * the periods to choose from. Server-only (reads the setting).
 */
export function ownBirthPeriod(stored: number | null | undefined): {
	birthPeriod: BirthPeriodChoice | null;
	birthPeriodOptions: BirthPeriodChoice[];
} {
	const size = env.BIRTH_PERIOD_YEARS;
	const start = stored == null ? null : birthPeriodStart(stored, size);
	return {
		birthPeriod:
			start === null
				? null
				: { value: start, label: birthPeriodLabel(start, size) },
		birthPeriodOptions: birthPeriodOptions(size),
	};
}
