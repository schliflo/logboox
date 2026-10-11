import type { Messages } from '../en/index';

export const range: Messages['range'] = {
	lastDays: (count) => `Letzte ${count} Tage`,
	short: { 'last-7': '7 Tage', 'last-30': '30 Tage', 'last-90': '90 Tage' },
	all: 'Alles',
	everything: 'Alles',
	timeRange: 'Zeitraum',
	timeRangeIs: (label) => `Zeitraum: ${label}`,
	more: 'Mehr',
	moreRanges: 'Weitere Zeiträume',
	updating: 'Wird aktualisiert',
	showingOnly: (label) =>
		`Nur ${label} wird angezeigt. Summen und Diagramme beziehen sich auf diesen Zeitraum, nicht auf den ganzen Export.`,
	showEverything: 'Alles anzeigen',
	recent: 'Zuletzt',
	months: 'Monate',
	years: 'Jahre',
	from: 'Von',
	to: 'Bis',
	apply: 'Anwenden'
};

export const dropZone: Messages['dropZone'] = {
	aria: 'Exportdateien hier ablegen',
	title: 'ZIP oder CSV-Dateien hier ablegen',
	hint: 'Alle Teile auf einmal sind in Ordnung. Wir sortieren und verbinden sie. Hier erstellte Sicherungen funktionieren auch.',
	choose: 'Dateien auswählen'
};

export const moved: Messages['moved'] = {
	backupFailed: 'Die Sicherung konnte nicht geschrieben werden',
	somethingWrong: 'Etwas ist schiefgelaufen.',
	title: (site, host) => `${site} ist umgezogen nach ${host}`,
	kept: 'Diese Adresse wird nicht mehr aktualisiert. Die in diesem Browser gespeicherten Exporte bleiben hier — sichere sie also zuerst und lege die Datei dann auf der Startseite unter der neuen Adresse ab, um sie mitzunehmen.',
	notKept:
		'Diese Adresse wird nicht mehr aktualisiert; ab jetzt passiert alles unter der neuen Adresse.',
	backUp: 'Alles sichern',
	open: (host) => `${host} öffnen`
};

export const offline: Messages['offline'] = {
	update: 'Eine neuere Version ist verfügbar',
	updateDetail:
		'Neu laden, um sie zu verwenden. Was gerade offen ist, lässt sich danach über die Startseite wieder öffnen.',
	reload: 'Neu laden',
	ready: 'Bereit für den Offline-Betrieb',
	readyDetail:
		'Die App ist jetzt in diesem Browser gespeichert und öffnet sich auch ohne Verbindung. Deine gespeicherten Exporte sind ebenfalls hier.'
};

export const notices: Messages['notices'] = {
	nothingRecorded: 'In dieser Zeit wurde nichts aufgezeichnet',
	tooLittle: (label) => `${label} enthält zu wenige Daten, um es einzeln anzuzeigen.`,
	rangeFailed: 'Dieser Zeitraum konnte nicht angezeigt werden',
	somethingWrong: 'Etwas ist schiefgelaufen.',
	notKept: 'Dieser Export wurde nicht gespeichert',
	notKeptDetail: (reason) =>
		`${reason} Du kannst ihn jetzt noch lesen, aber er ist weg, sobald der Tab geschlossen wird.`,
	kept: 'In diesem Browser gespeichert',
	keptDetail:
		'Dieser Export liegt jetzt auf deinem Gerät, du kannst ihn also wieder öffnen, ohne die Dateien erneut abzulegen. Entfernen kannst du ihn jederzeit auf der Startseite.',
	notCopied: 'Dieser Export wurde nicht in dein Konto kopiert',
	restored: (count) =>
		count === 1 ? 'Ein Export wiederhergestellt' : `${count} Exporte wiederhergestellt`,
	restoredSkipped: (count) => `${count} konnten von dieser Version der App nicht gelesen werden.`,
	restoredListed: 'Sie stehen unten bereit zum Öffnen.',
	candidateOne: (board, rank) =>
		board
			? `Deine Fahrt in „${board}“ wäre diesen Monat auf Platz ${rank}`
			: `Deine Fahrt wäre diesen Monat auf Platz ${rank}`,
	candidateMany: (count) =>
		`${count} deiner Fahrten würden es diesen Monat in die Bestenlisten schaffen`,
	candidateDetail:
		'Es wurde nichts veröffentlicht. Sieh es dir an und entscheide, ob du deinen Namen daruntersetzen willst.',
	see: 'Ansehen',
	logbookUnreadable: 'Das Fahrtenbuch konnte in diesem Browser nicht gelesen werden.'
};

export const errors: Messages['errors'] = {
	unreachable: 'LogbooX ist nicht erreichbar.',
	checkConnection: 'Prüfe deine Verbindung und versuche es erneut.',
	server: 'Auf dem Server ist etwas schiefgelaufen.',
	fetch: 'Das konnte nicht aus deinem Konto geholt werden.',
	localStore: 'Der lokale Speicher konnte nicht gelesen werden.',
	linkRequest: 'Der Link konnte nicht angefordert werden.',
	saveFailed: 'Das konnte nicht gespeichert werden.',
	noLogbookNote: 'Es ist kein Fahrtenbuch geöffnet, in dem diese Notiz gespeichert werden kann.',
	noLogbookNotes:
		'Es ist kein Fahrtenbuch geöffnet, in dem diese Notizen gespeichert werden können.'
};
