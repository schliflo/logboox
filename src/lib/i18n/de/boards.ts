import type { Messages } from '../en/index';

export const boards: Messages['boards'] = {
	items: {
		'peak-charge': {
			label: 'Schnellstes Laden',
			blurb: 'Die höchste Leistung, die ein Auto am Stecker tatsächlich aufgenommen hat.'
		},
		'biggest-charge': {
			label: 'Größte Ladung',
			blurb: 'Die meiste Energie in einem Ladevorgang, egal wie lange er dauerte.'
		},
		'longest-drive': {
			label: 'Längste Fahrt',
			blurb:
				'Die weiteste Strecke in einer einzigen Fahrt, ohne lange genug zu halten, um sie zu beenden.'
		},
		'efficient-drive': {
			label: 'Effizienteste Fahrt',
			blurb:
				'Der geringste Verbrauch pro hundert Kilometer, auf einer Fahrt, die lang genug ist, um zu zählen.'
		},
		'best-regen': {
			label: 'Beste Rekuperation',
			blurb: 'Der größte Anteil an Energie, der unterwegs zurück in die Batterie floss.'
		},
		'hardest-launch': {
			label: 'Stärkster Antritt',
			blurb: 'Die kräftigste Beschleunigung aus dem Stand, gemessen vom Auto selbst.'
		},
		'most-grip': {
			label: 'Meiste Haftung genutzt',
			blurb: 'Die stärkste Kurvenfahrt der Fahrt, Querkraft über die Reifen.'
		},
		'monthly-distance': {
			label: 'Am weitesten in einem Monat',
			blurb: 'Jeder im Monat gefahrene Kilometer, zusammengezählt.'
		}
	},
	groups: {
		Driving: 'Fahren',
		Efficiency: 'Effizienz',
		Charging: 'Laden',
		Handling: 'Fahrdynamik'
	},
	medals: { gold: 'Gold', silver: 'Silber', bronze: 'Bronze' }
};

export const claims: Messages['claims'] = {
	youAre: (rank, board) => `Du bist auf Platz ${rank} in „${board}“`,
	thatBoard: 'dieser Liste',
	takeDownLater: 'Du kannst ihn jederzeit in deinem Konto wieder zurückziehen.',
	takeDownLaterMonth: (month) => `${month}. Du kannst ihn jederzeit wieder zurückziehen.`,
	claimFailed: 'Dieser Platz konnte nicht beansprucht werden',
	nameFailed: 'Dieser Name konnte nicht gespeichert werden.',
	onTheBoard: 'In der Bestenliste:',
	forIn: (board, month) => `in „${board}“ im ${month}`,
	seeIt: 'Ansehen',
	wouldBe: 'Das wäre',
	forBoard: 'in',
	inMonth: (month) => `im ${month}`,
	nameHint:
		'Bestenlisten zeigen einen Namen statt deiner E-Mail-Adresse. Wähle einen, und der Platz gehört dir.',
	pickName: 'Namen wählen',
	claim: 'Beanspruchen',
	noThanks: 'Nein danke',
	notPublished: (date) => `Nichts wird veröffentlicht, bevor du zustimmst · offen bis ${date}`,
	yearSuffix: (year) => `${year} · das Jahr`,
	nameSaved: 'Unter diesem Namen erscheinen deine Plätze',
	takenDown: 'Zurückgezogen',
	takenDownDetail: 'Er verschwindet innerhalb weniger Minuten für alle aus der Liste.',
	saveFailed: 'Das konnte nicht gespeichert werden',
	title: 'Bestenliste',
	description:
		'Nichts von dir erscheint in einer Bestenliste, solange du es nicht selbst dort einträgst. Wenn etwas von dir einen Platz schaffen würde, steht es zuerst hier.',
	nameLabel: 'Der Name, unter dem deine Plätze erscheinen',
	change: 'Ändern',
	choose: 'Wählen',
	nameRules:
		'Buchstaben, Ziffern, Binde- und Unterstriche. Eine Bestenliste zeigt diesen Namen, das Modell deines Autos und die Werte, nie deine E-Mail-Adresse. Du kannst ihn einmal am Tag ändern.',
	notify: 'Sag mir Bescheid, wenn etwas von mir einen Platz schaffen würde',
	notifyHint:
		'In der App, und per E-Mail, wenn du ein paar Tage nicht da warst. Gilt auch für den Jahresrückblick.',
	waiting: 'Wartet auf dich',
	openUntil: (date) => `offen bis ${date}`,
	onBoards: 'In den Bestenlisten',
	closed: 'abgeschlossen',
	seeBoard: 'Zur Bestenliste',
	takeDown: 'Zurückziehen',
	badges: 'Abzeichen',
	medal: (name) => `${name}medaille`,
	getBadge: 'Abzeichen holen',
	nothingYet:
		'Noch nichts. Bewahre einen Export in deinem Konto auf, und alles, was einen Platz wert ist, taucht hier auf.',
	seeMonth: 'Bestenlisten dieses Monats ansehen',
	badgePublic:
		'Dieses Bild ist öffentlich: Jeder mit seiner Adresse kann es laden. Wenn du den Platz zurückziehst oder deinen Namen änderst, verschwindet es.',
	imageLink: 'Bildlink',
	snippetCopied: (label) => `${label} kopiert`,
	copyFailed: 'Kopieren nicht möglich',
	copyByHand: 'Markiere den Text und kopiere ihn von Hand.',
	copySnippet: (label) => `${label}-Schnipsel kopieren`
};

export const leaderboard: Messages['leaderboard'] = {
	year: (year) => `Das Jahr ${year}`,
	behind: (gap, rank) => `${gap} hinter Platz ${rank}`,
	listedAt: (rank) => `Auf Platz ${rank} eingetragen`,
	listFailed: 'Konnte nicht eingetragen werden',
	trips: (count, n) => `${count} ${n === 1 ? 'Fahrt' : 'Fahrten'}`,
	longest: (km) => `längste ${km} km`,
	seoTitle: (heading) => `Bestenliste · ${heading}`,
	seoDescription: (when) =>
		`${when}: Wofür XPeng-Fahrer ihren Namen hergegeben haben — das schnellste Laden, die längste Fahrt, die effizienteste Strecke.`,
	seoImageAlt: (heading) =>
		`Die Namen und Werte an der Spitze der LogbooX-Bestenlisten für ${heading}.`,
	youUnlisted: 'Du · noch nicht eingetragen',
	putName: 'Meinen Namen eintragen',
	pickName: 'Zuerst einen Namen wählen',
	title: 'Bestenliste',
	openUntil: (date) => `Offen bis ${date}`,
	open: 'Offen',
	final: 'Endgültig',
	period: 'Zeitraum',
	nothingLater: 'Noch nichts Späteres',
	month: 'Monat',
	yearTab: 'Jahr',
	emptyTitle: 'Noch nichts hier',
	emptyDetail: (when) =>
		`Für ${when} hat noch niemand einen Platz eingetragen. Wenn du einen eigenen Export hast, ist deiner vielleicht der erste.`,
	readOwn: 'Eigenen Export lesen',
	boards: 'Bestenlisten',
	nobodyYet: 'Noch niemand',
	listed: () => 'Fahrer eingetragen',
	nobodyOnBoard: (when) => `Für ${when} hat noch niemand einen Platz in dieser Liste eingetragen.`,
	topThree: 'Die ersten drei',
	you: 'du',
	openIt: 'Öffnen',
	further: 'Weitere Plätze',
	openEntry: (name, board) => `${board} von ${name} öffnen`,
	yourBadges: 'Deine Abzeichen',
	yourPlaces: 'Deine Plätze',
	as: (name) => `als ${name}`,
	copyEmbed: 'Einbettungscode kopieren',
	downloadPng: 'PNG herunterladen',
	badgesAndPlaces: 'Abzeichen und Plätze',
	podiums: 'Die meisten Podestplätze',
	acrossBoards: (year) => `Über alle Bestenlisten ${year}`,
	driver: 'Fahrer',
	wins: 'Siege',
	topThreeColumn: 'Top drei',
	how: 'Wie ein Platz hierher kommt',
	howDetail:
		'Jeder Wert stammt aus dem eigenen Export eines Fahrers, berechnet in dessen Browser, und steht hier, weil er seinen Namen daruntergesetzt hat. Melde dich an, bewahre einen Export in deinem Konto auf, und LogbooX sagt dir, wenn etwas von dir einen Platz schaffen würde. Nichts wird veröffentlicht, bevor du zustimmst, und du kannst es jederzeit zurückziehen.'
};
