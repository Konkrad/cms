import type { RequestHandler } from "@qwik.dev/router";
import { handleWebfingerGet } from "../../../../modules/social-web/actor";

// `/.well-known/webfinger`, rewritten here by `rewriteWellKnown` (Qwik never routes
// `/.well-known`). Today only the social-web account answers (404 while the module is inactive).
export const onGet: RequestHandler = (event) => handleWebfingerGet(event);
