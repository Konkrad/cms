import { createChallenge, verifySolution } from "altcha-lib/v1";
import { env } from "~/env";

export const altchaService = {
  async createChallenge() {
    return createChallenge({
      hmacKey: env.ALTCHA_HMAC_KEY,
      maxnumber: 150000,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });
  },

  async verifyPayload(payload: string): Promise<boolean> {
    if (!payload) {
      return false;
    }

    return verifySolution(payload, env.ALTCHA_HMAC_KEY, true);
  },
};
