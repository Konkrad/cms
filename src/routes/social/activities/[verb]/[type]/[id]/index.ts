import type { RequestHandler } from "@qwik.dev/router";
import { handleActivityGet } from "../../../../../../modules/social-web/outbox";

// One activity of the social-web outbox (404 while the module is inactive).
export const onGet: RequestHandler = (event) => handleActivityGet(event);
