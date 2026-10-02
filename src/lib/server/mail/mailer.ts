/**
 * Sending mail.
 *
 * A small interface, so the mails this app sends (sign-in links, export
 * reminders, board messages and the yearly summary) do not depend on who
 * carries them. In production that is Cloudflare's Email Service, through
 * a binding rather than an API key; a missing binding there is an error, not a
 * reason to print. Only in `vite dev` is the message printed instead, so the
 * sign-in link can be followed from the terminal.
 */

export interface Message {
	to: string;
	subject: string;
	text: string;
	html: string;
	/** Extra headers, such as `List-Unsubscribe`. The send binding takes them as they are. */
	headers?: Record<string, string>;
}

export interface Mailer {
	send(message: Message): Promise<void>;
}

/** The shape of the `send_email` binding this app uses. */
interface EmailBinding {
	send(message: {
		to: string;
		from: string;
		subject: string;
		text?: string;
		html?: string;
		headers?: Record<string, string>;
	}): Promise<unknown>;
}

export class MailError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'MailError';
	}
}

export function cloudflareMailer(binding: EmailBinding, from: string): Mailer {
	return {
		async send(message) {
			try {
				await binding.send({ ...message, from });
			} catch (error) {
				// The likely one is E_SENDER_NOT_VERIFIED: the domain has to be
				// verified in Email Service before anything leaves.
				throw new MailError(
					error instanceof Error ? error.message : 'The message could not be sent.',
					error
				);
			}
		}
	};
}

/**
 * Development. Prints the message where the sign-in link can be clicked, and
 * makes it obvious that nothing was actually sent.
 */
export function consoleMailer(): Mailer {
	return {
		async send(message) {
			console.info(
				`\n--- mail not sent, printed instead ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---\n`
			);
		}
	};
}

/** Drops every message. Used by the tests, and by the legacy Worker. */
export function nullMailer(): Mailer {
	return { async send() {} };
}
