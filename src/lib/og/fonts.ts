/**
 * The typeface the generated images are drawn in.
 *
 * Two static subsets of Inter — Latin, Latin Extended and the punctuation and
 * currency a European place name or a price needs — rather than the variable
 * woff2 the app itself loads: neither resvg nor pdf-lib reads woff2, and
 * pdf-lib's subsetter is unreliable on a variable font. Regular and SemiBold
 * both name `Inter` as their typographic family, so one family name and a
 * weight picks either.
 *
 * Imported as URLs so one pair of files serves both readers: the server reads
 * the bytes back with `read()` from `$app/server`, which only resolves assets
 * reachable by a *static* import, and the browser fetches the same URL when it
 * builds a PDF. Licensed under the SIL Open Font Licence; see LICENSE.txt
 * beside the files.
 */

import regular from './fonts/Inter-Regular.ttf?url';
import semibold from './fonts/Inter-SemiBold.ttf?url';

export const FONT_FAMILY = 'Inter';

/** Regular first: resvg falls back to the first face it was given. */
export const FONT_URLS = [regular, semibold];

export { regular as INTER_REGULAR_URL, semibold as INTER_SEMIBOLD_URL };
