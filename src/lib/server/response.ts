/**
 * JSON in and out.
 *
 * Everything an account route returns is private to one person, so nothing
 * here may be stored by a shared cache. Public share responses set their own
 * headers and do not go through `json`.
 */

import { json as kitJson } from '@sveltejs/kit';

export function json(body: unknown, init: ResponseInit = {}): Response {
	return kitJson(body, {
		...init,
		headers: { 'cache-control': 'private, no-store', ...init.headers }
	});
}

/** The body of a request, or null when it is not JSON at all. */
export async function readJson<T>(request: Request): Promise<T | null> {
	if (!request.headers.get('content-type')?.includes('application/json')) return null;
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}

export function fail(status: number, message: string, hint?: string): Response {
	return json({ error: message, hint }, { status });
}
