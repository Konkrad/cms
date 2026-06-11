import { type RequestHandler } from "@qwik.dev/router";

// Liveness/readiness probe for the Kamal proxy. Must stay dependency-free and fast —
// it only confirms the process is up and serving HTTP, not that downstream services
// (DB, S3, SMTP) are healthy.
export const onGet: RequestHandler = ({ send }) => {
  send(200, "OK");
};
