/**
 * Talking to our own server.
 *
 * Small on purpose: same-origin JSON, cookies included, and errors that arrive
 * as something worth showing a person rather than a status code. The failure
 * that matters most is the one where there is no server at all — an old
 * deployment, or a browser offline — and that reads as a sentence too.
 */

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly hint?: string
	) {
		super(message);
		this.name = 'ApiError';
	}

	/** True when signing in again is the answer. */
	get unauthorized(): boolean {
		return this.status === 401;
	}
}

export interface ApiOptions {
	method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	body?: unknown;
	signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const { method = 'GET', body, signal } = options;

	let response: Response;
	try {
		response = await fetch(path, {
			method,
			signal,
			credentials: 'same-origin',
			headers: body === undefined ? {} : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError('LogbooX could not be reached.', 0, 'Check your connection and try again.');
	}

	if (response.status === 204) return undefined as T;

	const text = await response.text();
	let parsed: unknown = null;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		parsed = null;
	}

	if (!response.ok) {
		const detail = parsed as { error?: string; hint?: string } | null;
		throw new ApiError(
			detail?.error ?? 'Something went wrong on the server.',
			response.status,
			detail?.hint
		);
	}

	return parsed as T;
}

/**
 * Raw bytes, for the compressed buffers. Kept apart from `api` because these
 * are megabytes at a time and must never be parsed as JSON.
 */
export async function apiBytes(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
	const response = await fetch(path, { credentials: 'same-origin', signal });
	if (!response.ok) {
		throw new ApiError(`Could not read ${path}.`, response.status);
	}
	return response.arrayBuffer();
}
