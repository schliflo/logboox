/**
 * The logbook as a file.
 *
 * A Fahrtenbuch is something people hand to an accountant or a tax office, so
 * what comes out here is a plain table with the columns those expect: the date,
 * the odometer at both ends, the distance, where the journey went and why.
 *
 * The columns and the writer both moved to `$lib/export` when the spreadsheet
 * and the PDF arrived and needed to agree with this. What is left is the name
 * the rest of the app already calls, and the file it produces is unchanged.
 */

import { toCsv } from '../export/csv';
import { exportFileName } from '../export/filenames';
import { LOGBOOK_COLUMNS, type LogbookRow } from '../export/columns';

export type { LogbookRow };

export function logbookCsv(rows: LogbookRow[], timeZone: string): string {
	return toCsv(LOGBOOK_COLUMNS, rows, timeZone);
}

export function logbookFileName(from: number, to: number, timeZone: string): string {
	return exportFileName('fahrtenbuch', from, to, timeZone, 'csv');
}
