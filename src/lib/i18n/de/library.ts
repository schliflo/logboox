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
	removeFailed: 'Es konnte nicht aus deinem Konto entfernt werden',
	removed: 'Aus deinem Konto entfernt',
	removedDetail:
		'Geteilte Links behalten ihre eigene Kopie. Die Kopie in diesem Browser bleibt unberührt.',
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
	details: (count) => `Die ${count} Wochen und Dateien dahinter`,
	openTogether: 'Als eine Aufzeichnung öffnen',
	both: 'Hier und in deinem Konto gespeichert',
	inAccount: 'In deinem Konto',
	onlyHere: 'Nur in diesem Browser',
	entry: (days, km, trips, size) => `${days} Tage · ${km} km · ${trips} Fahrten · ${size}`,
	more: 'Mehr zu diesem Export',
	openAlone: 'Einzeln öffnen',
	fetchOpen: 'Abrufen und öffnen',
	backUp: 'Sichern',
	keepInAccount: 'In meinem Konto speichern',
	fetchHere: 'In diesen Browser holen',
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

export const xpeng: Messages['xpeng'] = {
	title: 'Automatischer Import von XPeng',
	description:
		'LogbooX holt jeden Tag deinen Export bei XPeng ab und ergänzt dieses Konto um das Neue, als eine durchgehende Aufzeichnung. Kein Monat geht verloren, und du musst nichts tun.',
	connected: (date) => `Verbunden seit ${date}`,
	lastFetched: (date) => `zuletzt abgeholt ${date}`,
	nextFetch: (date) => `nächster Abruf ${date}`,
	exporting: 'XPeng erzeugt gerade einen Export.',
	importedTo: (date) => `Deine Aufzeichnung in diesem Konto reicht bis ${date}.`,
	messages: {
		downloadFailed:
			'Der letzte Download von XPeng ist fehlgeschlagen. Neuer Versuch innerhalb einer Stunde.',
		notImported:
			'Frühere Exporte konnten noch nicht importiert werden; bis dahin wird nichts Neues abgeholt.',
		exportFailed: 'XPeng konnte den Export nicht erzeugen. Neuer Versuch morgen.',
		limit: 'XPengs Grenze von fünf Exporten am Tag ist erreicht. Neuer Versuch morgen.',
		unauthorized:
			'XPeng kennt keine Freigabe für diese Zugangsdaten. Prüfe sie, oder gib LogbooX im XPeng Data Center erneut frei.',
		tokenExpired:
			'XPeng akzeptiert diesen Access-Token nicht mehr. Gib LogbooX im XPeng Data Center erneut frei und trage die neuen Zugangsdaten ein.',
		appError:
			'XPeng hat die Zugangsdaten von LogbooX selbst abgelehnt. Das beheben wir; du musst nichts tun.',
		error:
			'XPeng hat mit einem unerwarteten Fehler geantwortet. Neuer Versuch innerhalb einer Stunde.',
		importFailed:
			'Der letzte Export konnte nicht importiert werden. Das beheben wir; es wird erneut versucht.',
		quota: 'Dieses Konto ist voll, daher konnte der letzte Export nicht ergänzt werden.'
	},
	connect: 'Verbinden',
	replace: 'Neue Zugangsdaten eintragen',
	disconnect: 'Trennen',
	disconnected: 'Getrennt',
	disconnectedDetail: 'Es wird nichts mehr abgeholt. Was importiert wurde, bleibt im Konto.',
	formTitle: 'Deine XPeng-Zugangsdaten',
	formDetail:
		'Gib LogbooX zuerst im XPeng Data Center frei. XPeng schickt dir dann diese vier Werte per E-Mail; übernimm sie exakt.',
	enterpriseName: 'Unternehmensname, genau wie im Data Center eingegeben',
	save: 'Speichern',
	saving: 'Speichere …',
	saveFailed: 'Die Zugangsdaten konnten nicht gespeichert werden.',
	saved: 'Gespeichert',
	savedDetail:
		'Der erste Abruf startet innerhalb einer Stunde; die letzten dreißig Tage folgen kurz darauf.',
	guideBefore: 'Schritt für Schritt, mit allem, was wo einzutragen ist:',
	pulled: 'Neue Tage von XPeng',
	pulledDetail: 'In deine Aufzeichnung in diesem Browser übernommen.',
	open: 'Öffnen',
	update: 'Jetzt aktualisieren',
	updating: 'Frage bei XPeng an…',
	updateExporting:
		'XPeng bereitet die Datei vor, das dauert ein paar Minuten. Du kannst die Seite verlassen.',
	updateDone: 'Auf dem neuesten Stand',
	updateDoneDetail: 'Die neuesten Daten von XPeng sind in deiner Aufzeichnung.',
	updateWait: (time: string) => `Nächste Aktualisierung ab ${time} möglich.`,
	updateLater: 'XPeng ist noch dabei. Der nächste stündliche Lauf holt es ab.',
	updateFailed: 'Aktualisierung fehlgeschlagen'
};
