/** The envelope every `/api` route returns. */

export interface RequestMeta {
  method: string;
  url: string;
  /** Correlates a response with server logs; also returned in the `x-request-id` header. */
  requestId: string;
  /** Omitted in production. */
  ip?: string;
}

export interface HttpSuccessBody<T = unknown> {
  success: true;
  statusCode: number;
  request: RequestMeta;
  message: string;
  data: T;
}

export interface HttpErrorBody {
  success: false;
  statusCode: number;
  code: string;
  request: RequestMeta;
  message: string;
  /** What the CALLER needs to act (e.g. field-level validation issues). Sent in every environment. */
  data?: unknown;
  /** Stack trace — omitted in production. */
  trace?: string;
}

export type HttpBody<T = unknown> = HttpSuccessBody<T> | HttpErrorBody;

export function isHttpError<T>(body: HttpBody<T>): body is HttpErrorBody {
  return body.success === false;
}
