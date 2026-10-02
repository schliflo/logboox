/**
 * How much one account may keep.
 *
 * A month of telemetry compresses to five to fifteen megabytes, so two
 * gigabytes is years of exports for several cars — generous enough that nobody
 * meets it by using the app as intended, and low enough that a runaway client
 * cannot fill a bucket unnoticed.
 */

export const MAX_ACCOUNT_BYTES = 2 * 1024 * 1024 * 1024;

/** No single column of a month comes close to this; the timeline is the largest. */
export const MAX_BLOB_BYTES = 64 * 1024 * 1024;

/** Guards against a record that claims thousands of signals. */
export const MAX_COLUMNS = 512;

export function formatBytes(count: number): string {
	const units = ['B', 'kB', 'MB', 'GB'];
	let value = count;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
