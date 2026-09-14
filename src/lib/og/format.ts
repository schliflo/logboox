/**
 * Numbers for the generated images.
 *
 * A deliberate copy of four functions from `$lib/utils/format`, which cannot
 * be imported here: it reaches for the `settings` rune to know the viewer's
 * timezone, and a card has no viewer — it is drawn once, on a server, for
 * whoever the link is later pasted in front of. The copies take everything they
 * need as arguments and touch no state.
 */

export function num(value: number, digits = 0): string {
	if (!Number.isFinite(value)) return '—';
	return value.toLocaleString('en-GB', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}

export function measure(value: number, unit: string, digits = 0): string {
	if (!Number.isFinite(value)) return '—';
	return `${num(value, digits)}${unit ? ` ${unit}` : ''}`;
}

export function duration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	if (hours === 0) return minutes === 0 ? `${total} s` : `${minutes} min`;
	return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

/**
 * The same span with the spaces squeezed out, for a figure standing in a
 * column of its own. An overnight charge is `10h 55m` rather than
 * `10 h 55 min`, which is four characters too many to fit beside three others.
 */
export function shortDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	if (hours === 0) return minutes === 0 ? `${total}s` : `${minutes}m`;
	return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}
