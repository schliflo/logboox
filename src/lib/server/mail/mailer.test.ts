import { describe, expect, it } from 'vitest';
import { cloudflareMailer } from './mailer';

describe('the Cloudflare mailer', () => {
	it('hands the binding the sender and the headers as they are', async () => {
		const sent: unknown[] = [];
		const mailer = cloudflareMailer(
			{ send: async (message) => void sent.push(message) },
			'hello@logboox.app'
		);

		await mailer.send({
			to: 'reader@example.com',
			subject: 'Hello',
			text: 'text',
			html: '<p>html</p>',
			headers: { 'List-Unsubscribe': '<https://logboox.app/unsubscribe?token=t&kind=reminders>' }
		});

		expect(sent).toEqual([
			{
				to: 'reader@example.com',
				from: { name: 'LogbooX', email: 'hello@logboox.app' },
				subject: 'Hello',
				text: 'text',
				html: '<p>html</p>',
				headers: { 'List-Unsubscribe': '<https://logboox.app/unsubscribe?token=t&kind=reminders>' }
			}
		]);
	});
});
