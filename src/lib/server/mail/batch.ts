/**
 * What a run of mail does when sending goes wrong.
 *
 * Each person's mark is written before their message goes, so a run that dies
 * halfway cannot mail anyone twice. A send that fails keeps its mark too: the
 * queue is ordered by who is most overdue, so an address the mail service
 * refuses for good would otherwise sit at the front every day and, three at a
 * time, stop the batch before anyone behind it. What the failed mail was about
 * is not sent again: a reminder waits the normal interval, the board offers it
 * named are never mailed (the app still shows them), and the year roundup is
 * not retried at all.
 * Three failures in a row mean the sender, not the recipients, so the rest of
 * the batch is left unmarked for tomorrow rather than burned one by one.
 */

/** A sender that fails this many times running is down, not unlucky. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Counts failures across the whole daily run, so reminders, nudges and
 * roundups give up together rather than each trying three more times.
 */
export interface FailureStreak {
	succeeded(): void;
	failed(): void;
	readonly stopped: boolean;
}

export function failureStreak(): FailureStreak {
	let streak = 0;
	return {
		succeeded: () => {
			streak = 0;
		},
		failed: () => {
			streak++;
		},
		get stopped() {
			return streak >= MAX_CONSECUTIVE_FAILURES;
		}
	};
}

/**
 * An error's text with anything shaped like an address cut out: an address in
 * a log line outlives the account it belonged to, and a provider's error text
 * often repeats the address it refused.
 */
export function redactAddresses(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).replace(/\S+@\S+/g, '[address]');
}

/** Logs one failed send, naming the person by id alone. */
export function logSendFailure(what: string, userId: string, error: unknown): void {
	console.error(`${what} not sent for user ${userId}: ${redactAddresses(error)}`);
}
