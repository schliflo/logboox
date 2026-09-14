/**
 * A list as a CSV file.
 *
 * Semicolon-separated, with a byte-order mark and a decimal comma, because the
 * overwhelmingly likely destination is Excel in a locale where the comma is the
 * decimal point — and a file that opens as one column per row is a file nobody
 * can use. CRLF for the same reason.
 *
 * The rules were settled by the logbook download, which shipped first; this is
 * the same writer generalised over a column description, and the byte-for-byte
 * output has not changed. Its tests are the proof of that and should stay
 * exactly as they were written.
 */

import type { Column } from './columns';

const SEPARATOR = ';';

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
}

/**
 * A field containing the separator, a quote or a newline is quoted, and quotes
 * inside it are doubled — the one escaping rule every reader agrees on.
 */
function cell(text: string): string {
	return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(columns: Array<Column<T>>, rows: T[], timeZone: string): string {
	const date = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
	const time = formatter(timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });

	const render = (column: Column<T>, row: T): string => {
		const value = column.value(row);
		if (value === null || value === undefined) return '';

		switch (column.kind) {
			case 'date':
				return date.format(new Date(Number(value) * 1000));
			case 'time':
				return time.format(new Date(Number(value) * 1000));
			case 'number':
				return Number(value)
					.toFixed(column.digits ?? 0)
					.replace('.', ',');
			default:
				return String(value);
		}
	};

	const lines = [columns.map((column) => cell(column.header)).join(SEPARATOR)];
	for (const row of rows) {
		lines.push(columns.map((column) => cell(render(column, row))).join(SEPARATOR));
	}

	// Excel reads a file without this as the platform's legacy encoding, which
	// turns every umlaut in a place name into rubble.
	return `﻿${lines.join('\r\n')}\r\n`;
}
