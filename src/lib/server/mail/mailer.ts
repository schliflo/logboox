/**
 * Sending mail.
 *
 * Four lines of interface, so the two mails this app sends do not depend on
 * who carries them. In production that is Cloudflare's Email Service, through
 * a binding rather than an API key; in `vite dev` there is no binding, so the
 * message is printed and the sign-in link can be followed from the terminal.
 */

export interface Message {
	to: string;
	subject: string;
	text: string;
	html: string;
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
				`\n--- mail not sent (no EMAIL binding) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---\n`
			);
		}
	};
}

/** Drops every message. Used by the tests, and by the legacy Worker. */
export function nullMailer(): Mailer {
	return { async send() {} };
}
