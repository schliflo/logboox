/**
 * Asks the reader to report an unexpected error, once per kind of error.
 *
 * Errors the app explains to the reader — a file that is not an export, a
 * full disk — are not bugs and never come through here; see `isBug`.
 */

import { dev } from '$app/env';
import { page } from '$app/state';
import { toast } from 'svelte-sonner';
import { DataLoadError } from '#lib/data/client.js';
import { m } from '#lib/i18n/index.svelte.js';
import { describeError, isBug, issueUrl, signature, type ErrorDetail } from './issue';

/** Signatures already offered this session, so a render loop asks once. */
const offered = new Set<string>();

/** What to report about an error a caller caught, or undefined when it is not a bug. */
export function bugDetail(error: unknown): ErrorDetail | undefined {
	// The worker already decided, with the original error in hand.
	if (error instanceof DataLoadError) return error.report;
	return isBug(error) ? describeError(error) : undefined;
}

export function reportUrl(detail: ErrorDetail, route?: string | null): string {
	return issueUrl({
		error: detail,
		page: route ?? page.route.id ?? '(no route)',
		version: dev ? `${__COMMIT__} (dev)` : __COMMIT__,
		browser: navigator.userAgent
	});
}

/** A toast action that opens the prefilled issue. */
export function reportAction(detail: ErrorDetail, route?: string | null) {
	// Built now: by the time the button is pressed the reader may have moved on.
	const url = reportUrl(detail, route);
	return {
		label: m.report.action,
		onClick: () => window.open(url, '_blank', 'noopener,noreferrer')
	};
}

/** For errors nothing else caught. Never throws: it runs inside error handlers. */
export function reportUnexpected(detail: ErrorDetail, route?: string | null) {
	try {
		const key = signature(detail);
		if (offered.has(key)) return;
		offered.add(key);
		// One id: a second error replaces the prompt rather than stacking on it.
		toast.error(m.report.title, {
			id: 'error-report',
			description: m.report.detail,
			duration: 15000,
			closeButton: true,
			action: reportAction(detail, route)
		});
	} catch {
		// Reporting must not become the next error.
	}
}
