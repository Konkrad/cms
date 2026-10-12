import type { RequestHandler } from "@qwik.dev/router";
import { handleOutboxGet } from "../../../modules/social-web/outbox";

// Outbox of the social-web actor (404 while the module is inactive).
export const onGet: RequestHandler = (event) => handleOutboxGet(event);
