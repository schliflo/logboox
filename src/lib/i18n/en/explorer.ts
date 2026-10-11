export const explorer = {
	signals: 'Signals',
	signalsHint: 'Pick any combination to plot together.',
	showEmpty: 'Show never-reported',
	empty: 'empty',
	choose: 'Choose a signal',
	raw: 'Raw signals',
	window: (from: string, to: string) => `${from} – ${to} · drag to zoom`,
	resetZoom: 'Reset zoom',
	saveCsv: 'Save as CSV',
	selectHint: 'Select one or more signals from the list.',
	contain: 'What these signals contain',
	range: 'Range',
	reportedIn: 'Reported in',
	ofSamples: (share: string) => `${share}% of samples`
};
