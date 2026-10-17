import type { RequestHandler } from "@qwik.dev/router";
import { handleObjectGet } from "../../../../../modules/social-web/outbox";

// A note or article as an ActivityStreams object (404 while the module is inactive).
export const onGet: RequestHandler = (event) => handleObjectGet(event);
