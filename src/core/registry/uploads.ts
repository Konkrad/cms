import { moduleUploadRulesOf } from "~/core/router/uploads";
import { activeModules } from "./manifests";

/** Upload prefixes of the ACTIVE modules (an inactive module's prefixes are refused). */
export const activeUploadRules = moduleUploadRulesOf(activeModules);
