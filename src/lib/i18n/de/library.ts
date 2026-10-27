import type { Messages } from '../en/index';

export const tokens: Messages['tokens'] = {
	createFailed: 'Der Token konnte nicht erstellt werden.',
	revokeFailed: 'Der Token konnte nicht widerrufen werden',
	stillWorks: 'Er funktioniert weiterhin.',
	revoked: 'Token widerrufen',
	revokedDetail: (name) => `${name} funktioniert ab sofort nicht mehr.`,
	copied: 'Kopiert',
	copyFailed: 'Kopieren nicht möglich',
	copyByHand: 'Markiere den Token und kopiere ihn von Hand.',
	title: 'API-Zugang',
	description:
		'Lies deine eigenen Fahrten, Ladevorgänge und den zuletzt bekannten Zustand des Autos — aus Home Assistant, einem Skript oder allem anderen, das einen Header senden kann.',
	made: (date) => `erstellt ${date}`,
	lastUsed: (date) => `zuletzt genutzt ${date}`,
	neverUsed: 'nie genutzt',
	revoke: (name) => `${name} widerrufen`,
	none: 'Noch keine Tokens.',
	newToken: 'Neuer Token',
	readOnlyBefore:
		'Ein Token kann nur lesen; er kann nichts ändern und keinen weiteren Token erstellen. Die API ist dokumentiert in',
	copyNow: 'Jetzt kopieren',
	onlyOnce:
		'Er wird nur dieses eine Mal angezeigt. Geht er verloren, widerrufe ihn und erstelle einen neuen.',
	copyToken: 'Token kopieren',
	newTitle: 'Neuer API-Token',
	newDetail: 'Benenne ihn nach dem, was ihn nutzen wird, damit du später den richtigen widerrufst.',
	name: 'Name',
	namePlaceholder: 'Home Assistant',
	creating: 'Wird erstellt…',
	create: 'Token erstellen'
};

export const library: Messages['library'] = {
	demonstration: 'Demodaten',
	backupFailed: 'Die Sicherung konnte nicht geschrieben werden',
	somethingWrong: 'Etwas ist schiefgelaufen.',
	nothingCopied: 'Es wurde nichts in dein Konto kopiert',
	notCopied: (count) =>
		count === 1 ? 'Ein Export wurde nicht kopiert' : `${count} Exporte wurden nicht kopiert`,
	keptInAccount: (count) =>
		count === 1 ? 'In deinem Konto gespeichert' : `${count} Exporte in deinem Konto gespeichert`,
	keptInAccountDetail: 'Sie sind auch dann noch da, wenn dieser Browser alles vergisst.',
	linkCopied: 'Link kopiert',
	linkCopiedDetail:
		'Jeder mit diesem Link kann den Export lesen. Widerrufen kannst du ihn in deinem Konto.',
	linkFailed: 'Der Link konnte nicht erstellt werden',
	removeFailed: 'Es konnte nicht aus deinem Konto entfernt werden',
	removed: 'Aus deinem Konto entfernt',
	removedDetail:
		'Links auf den ganzen Export sind widerrufen. Die Kopie in diesem Browser bleibt unberührt.',
	fetchUnfinished: 'Das Abrufen wurde nicht abgeschlossen',
	fetchFailed: (count) =>
		count === 1
			? 'Dieser Export konnte nicht abgerufen werden'
			: 'Einige Exporte konnten nicht abgerufen werden',
	title: 'Importierte Dateien',
	intro: (signedIn) =>
		`Woraus deine Aufzeichnung besteht${signedIn ? ', gespeichert in diesem Browser, in deinem Konto oder beidem' : ', nur auf diesem Gerät gespeichert'}. Hier muss nichts täglich gepflegt werden.`,
	keepAll: (count) =>
		count === 1 ? 'In meinem Konto speichern' : `Alle ${count} in meinem Konto speichern`,
	backUpAll: 'Alles sichern',
	removeAll: 'Alles entfernen',
	demo: 'Demo',
	groupSpan: (span, count, memory) =>
		`${span} über ${count} Exporte, bis zu ${memory} Arbeitsspeicher auf einmal.`,
	heavy: 'Das ist sehr viel für einen einzelnen Tab.',
	openTogether: 'Als eine Aufzeichnung öffnen',
	both: 'Hier und in deinem Konto gespeichert',
	inAccount: 'In deinem Konto',
	onlyHere: 'Nur in diesem Browser',
	entry: (days, km, trips, size) => `${days} Tage · ${km} · ${trips} Fahrten · ${size}`,
	more: 'Mehr zu diesem Export',
	openAlone: 'Einzeln öffnen',
	fetchOpen: 'Abrufen und öffnen',
	backUp: 'Sichern',
	keepInAccount: 'In meinem Konto speichern',
	fetchHere: 'In diesen Browser holen',
	shareExport: 'Diesen Export teilen',
	removeAccount: 'Aus meinem Konto entfernen',
	removeHere: 'Aus diesem Browser entfernen',
	usage: (count, size) => `${count} ${count === 1 ? 'Export belegt' : 'Exporte belegen'} ${size}`,
	quota: (size) => `von etwa ${size}, die diese Seite nutzen darf.`,
	onDevice: 'auf diesem Gerät.',
	evictionWarning: (signedIn) =>
		`Ein Browser kann seinen Speicher selbst leeren — Safari tut das nach einer Woche Abwesenheit —, also sichere alles, was du behalten willst${signedIn ? ', oder lege eine Kopie in deinem Konto ab' : ''}.`,
	nothingHere:
		'In diesem Browser ist nichts gespeichert. Ruf einen Export ab, um ihn zu lesen, dann wird er auch hier gespeichert.',
	confirmTitle: 'Alle gespeicherten Exporte entfernen?',
	confirmDetail: (count, size) =>
		`Alle ${count}, ${size}, werden aus diesem Browser gelöscht. Die Originaldateien von XPeng bleiben unberührt, aber alles, was nicht gesichert ist, müsste erneut abgelegt werden.`,
	keepThem: 'Behalten'
};
