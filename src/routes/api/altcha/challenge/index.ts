import type { RequestHandler } from "@qwik.dev/router";
import { altchaService } from "~/services/altcha.service";

export const onGet: RequestHandler = async ({ json }) => {
  const challenge = await altchaService.createChallenge();
  json(200, challenge);
};
