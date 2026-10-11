import type { Messages } from '../en/index';

export const common: Messages['common'] = {
	done: 'Fertig',
	cancel: 'Abbrechen',
	close: 'Schließen',
	save: 'Speichern',
	saving: 'Wird gespeichert…',
	copy: 'Kopieren',
	copied: 'Kopiert',
	delete: 'Löschen',
	remove: 'Entfernen',
	retry: 'Erneut versuchen',
	loading: 'Wird geladen…',
	back: 'Zurück',
	next: 'Weiter',
	previous: 'Zurück',
	none: 'Keine',
	noReading: 'kein Messwert',
	demoData: 'Demodaten',
	sharedWithYou: 'Mit dir geteilt',
	dashboard: 'Dashboard',
	imprint: 'Impressum',
	privacy: 'Datenschutz',
	terms: 'Nutzungsbedingungen',
	language: 'Sprache',
	andMore: 'und weitere',
	andOthers: 'und andere'
};

export const format: Messages['format'] = {
	weekdays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
	daysHours: (days, hours) => `${days} T ${hours} Std`
};

export const nav: Messages['nav'] = {
	home: 'Start',
	trips: 'Fahrten & Fahrtenbuch',
	tripsShort: 'Fahrten',
	tripsTab: 'Fahrten',
	logbookTab: 'Fahrtenbuch',
	energy: 'Laden & Batterie',
	energyShort: 'Energie',
	chargingTab: 'Laden',
	batteryTab: 'Batterie',
	insights: 'Einblicke',
	insightsOverviewTab: 'Überblick',
	drivingTab: 'Fahrstil',
	doorsTyresTab: 'Türen & Reifen',
	explorerTab: 'Signal-Explorer',
	privacyTab: 'Was sie weiß',
	leaderboard: 'Bestenliste',
	leaderboardShort: 'Bestenliste',
	data: 'Daten & Konto',
	dataShort: 'Daten',
	sections: 'Bereiche',
	areaSections: (area) => `Bereiche von ${area}`
};

export const shell: Messages['shell'] = {
	yourCar: 'Dein Auto',
	community: 'Community',
	openExport: 'Export öffnen',
	replay: 'Highlights noch einmal',
	backToStart: (site) => `${site} — zurück zum Start`,
	tripsWithoutPlace: (count) => `${count} Fahrten ohne Ort`,
	madeBy: 'Gemacht von',
	demoCar: 'Demo-Auto',
	since: (label, date) => `${label} · seit ${date}`,
	upTo: (date) => `Bis ${date}`,
	addNewer: 'Neuere Daten hinzufügen',
	dashDescription:
		'Fahrten, Laden, Batterie und Fahrstil, ausgelesen aus deinem eigenen XPeng-Export.'
};

export const progress: Messages['progress'] = {
	gettingStarted: 'Es geht los',
	phases: {
		reading: 'Dateien werden gelesen',
		parsing: 'Signale werden ausgewertet',
		joining: 'Zeitachse wird ausgerichtet',
		analyzing: 'Muster werden gesucht',
		generating: 'Demodaten werden erzeugt',
		storing: 'Kopie wird in diesem Browser abgelegt',
		loading: 'Gespeicherter Export wird gelesen',
		merging: 'Zeitachsen werden zusammengeführt',
		packing: 'Sicherung wird gepackt',
		restoring: 'Sicherung wird wiederhergestellt',
		uploading: 'Wird in dein Konto kopiert',
		downloading: 'Wird aus deinem Konto geholt'
	},
	streams: {
		status: 'Türen & Reifen',
		operation: 'Fahren',
		power: 'Batterie & Leistung'
	},
	part: (index, count) => `Export ${index} von ${count}`,
	bytesOf: (loaded, total) => `${loaded} von ${total}`,
	local: 'Alles passiert in diesem Browser-Tab. Es wird nichts hochgeladen.'
};

export const purpose: Messages['purpose'] = {
	business: 'Geschäftlich',
	commute: 'Arbeitsweg',
	private: 'Privat',
	label: 'Zuordnen'
};

export const findings: Messages['findings'] = {
	whatStandsOut: 'Was auffällt'
};
