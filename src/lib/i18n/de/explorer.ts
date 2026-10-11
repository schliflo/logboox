import type { Messages } from '../en/index';

export const explorer: Messages['explorer'] = {
	signals: 'Signale',
	signalsHint: 'Wähle beliebige Kombinationen, um sie gemeinsam darzustellen.',
	showEmpty: 'Nie gemeldete anzeigen',
	empty: 'leer',
	choose: 'Wähle ein Signal',
	raw: 'Rohsignale',
	window: (from, to) => `${from} – ${to} · zum Zoomen ziehen`,
	resetZoom: 'Zoom zurücksetzen',
	saveCsv: 'Als CSV speichern',
	selectHint: 'Wähle ein oder mehrere Signale aus der Liste.',
	contain: 'Was diese Signale enthalten',
	range: 'Bereich',
	reportedIn: 'Gemeldet in',
	ofSamples: (share) => `${share} % der Messpunkte`
};
