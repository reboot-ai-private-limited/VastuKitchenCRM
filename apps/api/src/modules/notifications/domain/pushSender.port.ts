export interface PushMessage {
  title: string;
  body: string;
  /** String-only key/values the app reads to open the right screen (FCM data must be strings). */
  data: Record<string, string>;
  /** Same-tag pushes replace each other on the phone (used to batch reminders). */
  collapseKey?: string;
  /** Android notification channel; the app creates these. */
  channelId: string;
}

export interface PushResult {
  /** Tokens FCM rejected as unregistered/invalid: the caller deletes them. */
  invalidTokens: string[];
}

/** Port for the push provider, so use cases never import firebase-admin. */
export interface PushSenderPort {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}
