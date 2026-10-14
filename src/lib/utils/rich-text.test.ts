import { describe, expect, it } from 'vitest';
import { markdownText, parseRichText, plainText } from './rich-text';

describe('rich text', () => {
	it('finds links, code and the bare request page', () => {
		expect(parseRichText('See [the guide](/guides/x), `ds`, or xpeng.com/data-act.')).toEqual([
			{ kind: 'text', text: 'See ' },
			{ kind: 'link', text: 'the guide', href: '/guides/x' },
			{ kind: 'text', text: ', ' },
			{ kind: 'code', text: 'ds' },
			{ kind: 'text', text: ', or ' },
			{ kind: 'link', text: 'xpeng.com/data-act', href: 'https://www.xpeng.com/data-act' },
			{ kind: 'text', text: '.' }
		]);
	});

	it('does not link the request page twice inside a written link', () => {
		const parts = parseRichText('[xpeng.com/data-act](https://www.xpeng.com/data-act)');
		expect(parts).toEqual([
			{ kind: 'link', text: 'xpeng.com/data-act', href: 'https://www.xpeng.com/data-act' }
		]);
	});

	it('strips markup for meta tags and keeps it for Markdown', () => {
		expect(plainText('Read [this](/a) and `b`.')).toBe('Read this and b.');
		expect(markdownText('Read [this](/a).', 'https://x.test')).toBe(
			'Read [this](https://x.test/a).'
		);
	});
});
