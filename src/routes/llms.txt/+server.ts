/** A Markdown index of the site for language models; see `#lib/llms.ts`. */

import { llmsIndex } from '#lib/llms.js';

export const prerender = true;

export function GET(): Response {
	return new Response(llmsIndex(), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
}
