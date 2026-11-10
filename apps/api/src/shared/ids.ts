import { v7 as uuidv7 } from 'uuid';

/** `req_` + UUID v7. v7 sorts by creation time, so a request's log lines group in order. */
export const newRequestId = (): string => `req_${uuidv7()}`;
