import type { Messages } from '../en/index';

export const verify: Messages['verify'] = {
	title: 'Anmelden',
	welcome: 'Willkommen bei LogbooX',
	signedIn: 'Angemeldet',
	createdDetail: 'Dein Konto ist bereit. Es wurde noch nichts hochgeladen.',
	returningDetail: 'Alles, was du in diesem Browser gespeichert hast, ist noch da.',
	unusable: 'Dieser Link konnte nicht verwendet werden.',
	heading: 'Bei LogbooX anmelden',
	noAccounts: 'Unter dieser Adresse gibt es keine Konten.',
	oneClick: 'Ein Klick, und du bist fertig. Der Link funktioniert einmal.',
	noToken: 'Diesem Link fehlt sein Token.',
	signInAt: 'Melde dich stattdessen unter',
	instead: 'an.',
	backToStart: 'Zurück zum Start',
	signingIn: 'Anmeldung läuft…',
	signIn: 'Anmelden',
	waits:
		'Nichts passiert, bevor du da draufklickst. Links in E-Mails werden oft von Software geöffnet, bevor ein Mensch sie sieht — deshalb wartet dieser hier.'
};

export const unsubscribe: Messages['unsubscribe'] = {
	title: 'E-Mails abbestellen',
	failed: 'Das hat nicht geklappt.',
	boardOff: 'Nachrichten zur Bestenliste sind aus',
	remindersOff: 'Erinnerungen sind aus',
	stopBoard: 'Keine Nachrichten mehr zu Plätzen in einer Bestenliste?',
	stopReminders: 'Keine Erinnerungen mehr an neue Exporte?',
	boardDone: (email) =>
		`${email} bekommt keine Nachrichten mehr zu Plätzen in einer Bestenliste oder zum Jahresrückblick, außer du schaltest sie in deinem Konto wieder ein.`,
	remindersDone: (email) =>
		`${email} bekommt keine Erinnerungen mehr an neue Exporte, außer du schaltest sie in deinem Konto wieder ein.`,
	boardExplain:
		'Deine Plätze bleiben genau, wie sie sind. Das stoppt nur die Nachrichten, wenn etwas von dir einen Platz schaffen würde, und den Jahresrückblick.',
	remindersExplain:
		'Du kannst weiterhin jederzeit Exporte importieren. Das stoppt nur die Nachrichten.',
	calendar:
		'XPeng bewahrt nur die jeweils letzten dreißig Tage auf. Ohne Erinnerung lohnt sich ein Eintrag im eigenen Kalender.',
	backToAccount: 'Zurück zu deinem Konto',
	openAccount: 'Dein Konto öffnen',
	turningOff: 'Wird ausgeschaltet…',
	stopThese: 'Diese Nachrichten abbestellen',
	stopTheReminders: 'Erinnerungen abbestellen',
	noToken: 'Diesem Link fehlt sein Token.'
};

export const accountPage: Messages['accountPage'] = {
	title: 'Konto',
	saveFailed: 'Das konnte nicht gespeichert werden',
	deleted: 'Konto gelöscht',
	deletedDetail:
		'Alles, was im Konto gespeichert war, ist weg. Was in diesem Browser liegt, bleibt unberührt.',
	deleteFailed: 'Das Konto konnte nicht gelöscht werden',
	backToStart: 'Zurück zum Start',
	elsewhere: 'Konten gibt es unter logboox.app',
	elsewhereDetail: 'Diese Adresse bedient eine ältere Version ohne Kontendatenbank.',
	yours: 'Dein Konto',
	profileDetail:
		'Angemeldet über einen Link per E-Mail. Es gibt kein Passwort, das man vergessen kann.',
	memberSince: (date) => `Dabei seit ${date}`,
	onThisPage: 'Auf dieser Seite',
	exportsKept: (count) => `${count} ${count === 1 ? 'Export gespeichert' : 'Exporte gespeichert'}`,
	usedOf: (used, quota) => `${used} von ${quota}`,
	nothingYet: (quota) => `noch nichts, von ${quota}`,
	nearlyFull: (share) =>
		`${share} belegt. Entferne einen Export, den du nicht mehr brauchst, um Platz zu schaffen.`,
	signOut: 'Abmelden',
	keepingAndReminders: 'Aufbewahren & Erinnern',
	keepingDetail:
		'Eine Kopie im Konto überdauert diesen Browser. Exporte werden weiterhin hier gelesen und hier gespeichert. Es wird nichts kopiert, außer du bittest darum oder schaltest das hier ein.',
	autoSync: 'Neue Importe automatisch in mein Konto kopieren',
	remindersDetail:
		'XPeng hält immer nur die letzten dreißig Tage vor. Ein Monat, den niemand angefordert hat, lässt sich später nicht zurückholen.',
	reminderSwitch: 'Mir eine E-Mail schicken, wenn ein neuer Export fällig ist',
	reminderDays: 'Nach so vielen Tagen erinnern',
	reminderHint: 'Gezählt ab dem Ende deines neuesten Exports, nicht ab dem Zeitpunkt des Imports.',
	deleteTitle: 'Dieses Konto löschen',
	deleteDetail:
		'Entfernt das Konto, jeden darin gespeicherten Export und jeden geteilten Link samt den Dateien dahinter. Was in diesem Browser liegt, bleibt, wo es ist.',
	deleteButton: 'Konto löschen',
	deleteConfirmDetail:
		'Das lässt sich nicht rückgängig machen. Sichere vorher alles, was du behalten willst — die Kopien in diesem Browser sind nicht betroffen.',
	typeBefore: 'Gib',
	typeAfter: 'ein, um zu bestätigen',
	confirmWord: 'löschen',
	keepIt: 'Behalten',
	deleteEverything: 'Alles löschen',
	notSignedIn: 'Nicht angemeldet',
	takingBack: 'Du wirst zum Start zurückgebracht.'
};
