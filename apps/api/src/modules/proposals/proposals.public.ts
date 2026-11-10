/**
 * The only thing another module may import from `proposals/`. Nothing yet: the notifications
 * module reacts to the `proposal.seen` event, and the reminders module will add the queries it
 * needs (unseen / seen-but-no-action) here when it is built.
 */
export type ProposalsPublicContract = Record<string, never>;
