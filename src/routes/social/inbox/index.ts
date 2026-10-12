import type { RequestHandler } from "@qwik.dev/router";
import { handleInboxRequest } from "../../../modules/social-web/actor";

// Poll-only inbox of the social-web actor: GET is an empty collection, every write answers 405
// (404 while the module is inactive). Handles all methods, so there is no onPost to authorize.
export const onRequest: RequestHandler = (event) => handleInboxRequest(event);
