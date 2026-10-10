import type { RequestHandler } from "@qwik.dev/router";
import { handleTicketQrGet } from "../../../../../modules/events/profile-tickets-qr";

export const onGet: RequestHandler = (event) => handleTicketQrGet(event);
