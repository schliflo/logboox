/**
 * Turns an unexpected error into a prefilled GitHub issue.
 *
 * Nothing is sent anywhere: the reader is handed a link to the issue form
 * (`.github/ISSUE_TEMPLATE/bug_report.yml`), sees every field, and submits it
 * themselves. Only the error, the route, the build and the browser go in —
 * never anything read from an export.
 */

export const NEW_ISSUE_URL = 'https://github.com/schliflo/logboox/issues/new';

/** A thrown value reduced to what survives `postMessage` and fits in a URL. */
export interface ErrorDetail {
	name: string;
	message: string;
	stack?: string;
}

export interface IssueReport {
	error: ErrorDetail;
	/** A route id like `/s/[id]`, never a path: paths can carry share ids. */
	page: string;
	version: string;
	browser: string;
}

/** GitHub answers 414 somewhere past 8 KB; the stack gives way first. */
const MAX_URL = 6000;
const MAX_FRAMES = 15;

export function describeError(error: unknown): ErrorDetail {
	if (error instanceof Error) {
		return { name: error.name || 'Error', message: error.message, stack: error.stack };
	}
	return { name: 'Thrown value', message: String(error).slice(0, 200) };
}

/**
 * Programming errors, as opposed to the messages the app writes for readers
 * (`throw new Error('This ZIP is not a backup made by this app.')`). Only
 * these are worth asking someone to report.
 */
const BUG_NAMES = new Set([
	'TypeError',
	'RangeError',
	'ReferenceError',
	'SyntaxError',
	'EvalError',
	'URIError',
	'DataCloneError'
]);

export function isBug(error: unknown): boolean {
	return (!(error instanceof Error) || BUG_NAMES.has(error.name)) && !isNoise(describeError(error));
}

const NOISE = [
	// A cross-origin script; nothing to go on.
	/^Script error\.?$/,
	// Benign, and fired by the browser rather than by anything broken.
	/ResizeObserver loop/,
	// A deploy replaced the chunks this tab was built against; SvelteKit reloads.
	/dynamically imported module|Importing a module script failed/,
	// Offline or a dropped connection: a `TypeError` from `fetch`, in Chrome, Firefox, Safari.
	/^(Failed to fetch|NetworkError when attempting to fetch resource\.|Load failed)$/
];

/** Errors that are not a bug in this app, or not one a report would help with. */
export function isNoise(detail: ErrorDetail): boolean {
	return detail.name === 'AbortError' || NOISE.some((pattern) => pattern.test(detail.message));
}

/**
 * Whether an error caught globally came from this app rather than from an
 * extension or an injected script, which share the page's error events.
 */
export function isOurs(detail: ErrorDetail, origin: string, filename?: string): boolean {
	if (filename) return filename.startsWith(origin) || filename.startsWith(`blob:${origin}`);
	return detail.stack?.includes(origin) ?? false;
}

/**
 * Hosts and query strings out of URLs: the origin is known, and queries are
 * nobody's business. Double-quoted spans go too: that is how V8 quotes the
 * input in a JSON `SyntaxError`, and a backup's records hold the VIN.
 */
function scrub(text: string): string {
	return text
		.replace(/".*"/g, '"…"')
		.replace(/\b(?:blob:)?https?:\/\/[^/\s)]+/g, '')
		.replace(/(\.[a-z]+)\?[^\s:)]+/gi, '$1');
}

/** One line, the same for every occurrence, so duplicates are easy to spot. */
export function signature(detail: ErrorDetail): string {
	return `${detail.name}: ${scrub(detail.message)}`.slice(0, 200);
}

function errorText(detail: ErrorDetail): string {
	const head = signature(detail);
	if (!detail.stack) return head;
	const lines = scrub(detail.stack).split('\n');
	// V8 opens the stack with a `Name: message` line; Firefox and Safari list frames only.
	const frames = /^\s+at |@/.test(lines[0]) ? lines : lines.slice(1);
	return [head, ...frames.slice(0, MAX_FRAMES)].join('\n');
}

export function issueUrl(report: IssueReport): string {
	const build = (error: string) =>
		`${NEW_ISSUE_URL}?${new URLSearchParams({
			template: 'bug_report.yml',
			title: `[Bug] ${signature(report.error)}`.slice(0, 120),
			error,
			page: report.page,
			version: report.version,
			browser: report.browser.slice(0, 300)
		})}`;

	const full = errorText(report.error);
	let kept = full.length;
	let url = build(full);
	while (url.length > MAX_URL && kept > 0) {
		kept = Math.floor(kept * 0.8);
		url = build(`${full.slice(0, kept)}…`);
	}
	return url;
}
