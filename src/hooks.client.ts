/**
 * Offers a bug report for errors nothing in the app caught: those SvelteKit
 * sees while navigating, and those that reach the window.
 */

import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { describeError, isNoise, isOurs } from '#lib/report/issue.js';
import { reportUnexpected } from '#lib/report/reporter.js';

export const handleError: HandleClientError = ({ error, kind, event }) => {
	// `app` and `framework` errors are a 404 or an `error(…)` the app meant.
	if (kind !== 'unknown') return;
	const detail = describeError(error);
	if (!isNoise(detail)) reportUnexpected(detail, event.route.id);
};

export const init: ClientInit = () => {
	// The window also hears extensions and injected scripts, so only errors
	// thrown from this origin count.
	window.addEventListener('error', (event) => {
		const detail = describeError(event.error ?? event.message);
		if (!isNoise(detail) && isOurs(detail, location.origin, event.filename)) {
			reportUnexpected(detail);
		}
	});
	window.addEventListener('unhandledrejection', (event) => {
		const detail = describeError(event.reason);
		if (!isNoise(detail) && isOurs(detail, location.origin)) reportUnexpected(detail);
	});
};
