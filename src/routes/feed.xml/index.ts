import type { RequestHandler } from "@qwik.dev/router";
import { handleFeedGet } from "../../modules/social-web/feed";

// RSS feed of the social-web module (404 while it is inactive).
export const onGet: RequestHandler = (event) => handleFeedGet(event);
