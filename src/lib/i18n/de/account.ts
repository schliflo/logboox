import type { Messages } from '../en/index';

export const accountMenu: Messages['accountMenu'] = {
	benefits: [
		'Deine Exporte dauerhaft behalten, nicht nur bis dieser Browser sie vergisst',
		'Eine Erinnerung, wenn der nächste Export fällig ist, bevor das Zeitfenster vorbei ist',
		'Deine eigenen Daten per API lesen, für Home Assistant und alles andere',
		'Eine einzelne Fahrt oder einen Ladevorgang per Link teilen'
	],
	signedOut: 'Abgemeldet',
	signedOutDetail: 'Alles, was in diesem Browser gespeichert ist, ist noch da.',
	placesWaiting: (count) =>
		count === 1 ? 'Ein Platz wartet auf dich' : `${count} Plätze warten auf dich`,
	account: 'Konto',
	leaderboard: 'Bestenliste',
	signOut: 'Abmelden',
	signIn: 'Anmelden',
	checkInbox: 'Schau in dein Postfach',
	linkSent: (email) =>
		`Falls ${email} ein Konto haben kann, ist ein Anmeldelink unterwegs. Er funktioniert einmal und läuft nach fünfzehn Minuten ab.`,
	differentAddress: 'Andere Adresse verwenden',
	title: 'Bei LogbooX anmelden',
	noPassword: 'Es gibt kein Passwort. Gib deine Adresse ein und wir schicken dir einen Link.',
	email: 'E-Mail-Adresse',
	emailPlaceholder: 'du@example.com',
	sending: 'Wird gesendet…',
	sendLink: 'Link schicken',
	smallPrintBefore:
		'Ein Konto ändert nichts daran, wie dein Export gelesen wird: Er wird weiterhin in diesem Tab ausgewertet. Es wird nichts dorthin kopiert, außer du bittest darum oder schaltest das automatische Kopieren ein. Mit der Anmeldung akzeptierst du die',
	smallPrintTerms: 'Nutzungsbedingungen',
	smallPrintMiddle: '; die',
	smallPrintPrivacy: 'Datenschutzerklärung',
	smallPrintAfter: 'sagt, was ein Konto speichert.'
};
