/**
 * The little markup the catalogs' long-form copy carries: `[label](href)` for
 * a link, `code` for a code span, and a bare mention of XPeng's request page,
 * which always links there. Kept this small so translators can see the text.
 */

export type Part =
	| { kind: 'text'; text: string }
	| { kind: 'code'; text: string }
	| { kind: 'link'; text: string; href: string };

const REQUEST_HOST = 'xpeng.com/data-act';
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|xpeng\.com\/data-act/g;

export function parseRichText(source: string): Part[] {
	const parts: Part[] = [];
	let last = 0;
	for (const match of source.matchAll(TOKEN)) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ kind: 'text', text: source.slice(last, index) });
		if (match[1] !== undefined) parts.push({ kind: 'link', text: match[1], href: match[2] });
		else if (match[3] !== undefined) parts.push({ kind: 'code', text: match[3] });
		else parts.push({ kind: 'link', text: REQUEST_HOST, href: `https://www.${REQUEST_HOST}` });
		last = index + match[0].length;
	}
	if (last < source.length) parts.push({ kind: 'text', text: source.slice(last) });
	return parts;
}

/** The same text with the markup removed, for meta tags and structured data. */
export function plainText(source: string): string {
	return parseRichText(source)
		.map((part) => part.text)
		.join('');
}

/** The same text as Markdown, with site links made absolute against `origin`. */
export function markdownText(source: string, origin: string): string {
	return parseRichText(source)
		.map((part) => {
			if (part.kind === 'code') return `\`${part.text}\``;
			if (part.kind === 'link') {
				const href = part.href.startsWith('/') ? `${origin}${part.href}` : part.href;
				return `[${part.text}](${href})`;
			}
			return part.text;
		})
		.join('');
}
