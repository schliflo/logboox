/** The guides, FAQ and features in full, for language models; see `#lib/llms.ts`. */

import { llmsFull } from '#lib/llms.js';

export const prerender = true;

export function GET(): Response {
	return new Response(llmsFull(), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
}
