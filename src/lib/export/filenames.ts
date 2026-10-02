/**
 * What a downloaded file is called.
 *
 * The period it covers and nothing else about the car. No vehicle
 * identification number, following the same rule as the backup archive: a file
 * downloaded to a work laptop or mailed to an accountant should not carry the
 * one number that ties a car to a registration record.
 */

export type ExportKind = 'fahrtenbuch' | 'charging';

export type Extension = 'csv' | 'xlsx' | 'pdf';

/** ISO order, so a folder of these sorts by date rather than by day-of-month. */
function stamp(epochSeconds: number, timeZone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone
	})
		.format(new Date(epochSeconds * 1000))
		.split('/')
		.reverse()
		.join('-');
}

export function exportFileName(
	kind: ExportKind,
	from: number,
	to: number,
	timeZone: string,
	extension: Extension
): string {
	return `logboox-${kind}-${stamp(from, timeZone)}-to-${stamp(to, timeZone)}.${extension}`;
}
