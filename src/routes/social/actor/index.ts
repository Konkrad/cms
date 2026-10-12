import type { RequestHandler } from "@qwik.dev/router";
import { handleActorGet } from "../../../modules/social-web/actor";

// The social-web module's ActivityPoll actor (404 while the module is inactive).
export const onGet: RequestHandler = (event) => handleActorGet(event);
