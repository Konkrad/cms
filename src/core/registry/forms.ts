import {
	coreFormPurposes,
	type FormPurpose,
	indexFormPurposes,
} from "~/core/forms/purposes";
import { formPurposesOf } from "~/core/router/modules";
import { activeModules } from "./manifests";

const purposes = indexFormPurposes([
	...coreFormPurposes,
	...formPurposesOf(activeModules),
]);

/** Form purposes of core and the active modules (the forms admin offers these). */
export const formPurposes = (): FormPurpose[] => [...purposes.values()];

export const isFormPurpose = (purpose: string): boolean =>
	purposes.has(purpose);
