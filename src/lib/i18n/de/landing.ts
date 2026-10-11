import type { Messages } from '../en/index';

export const landing: Messages['landing'] = {
	howTo: 'So bekommst du deine Daten',
	leaderboard: 'Bestenliste',
	promise: 'Nichts verlässt diesen Browser, außer du willst es',
	headline: 'Dein Auto führt',
	headlineAccent: 'ein sehr genaues Tagebuch.',
	lede: 'Leg den Export ab, den XPeng nach dem EU Data Act verschickt. Du bekommst deine Fahrten, Ladevorgänge, Batteriedaten und ein fertiges Fahrtenbuch.',
	demo: 'Mit einem Demo-Monat ausprobieren',
	noExport: 'Noch kein Export? Eine Anfrage dauert etwa eine Woche.',
	welcome: 'Willkommen zurück',
	daysRecorded: (count) => (count === 1 ? 'Tag aufgezeichnet' : 'Tage aufgezeichnet'),
	demoCar: 'Das Demo-Auto, ',
	open: 'Mein Dashboard öffnen',
	joinOn: 'Leg neuere Dateien ab, und sie werden von selbst angefügt.',
	gettingExport: 'So bekommst du deinen Export',
	requestAt: 'Fordere ihn an unter',
	steps: [
		'Lade das ZIP herunter, wenn die E-Mail ankommt. Es umfasst die letzten 30 Tage.',
		'Leg es hier ab. Frag jeden Monat erneut an, um eine längere Aufzeichnung aufzubauen.'
	],
	imported: (count) => `Importierte Dateien (${count})`,
	highlights: [
		{
			title: 'Jede Fahrt, Sekunde für Sekunde',
			body: 'Geschwindigkeit, Pedal, Lenkung und Bremse mit einem Messpunkt pro Sekunde — genug, um einzelne Fahrmanöver nachzuspielen, nicht nur Fahrten.'
		},
		{
			title: 'Was Laden wirklich kostet',
			body: 'Ladevorgänge automatisch erkannt, Energie aus Akkuspannung und -strom berechnet, und die Reichweite, an die dein Auto selbst glaubt.'
		},
		{
			title: 'Der Alltag, den du niemandem erzählt hast',
			body: 'Allein die Türöffnungen zeichnen deine Woche nach: wann du gehst, wann du zurückkommst und an welchen Tagen du gar nicht raus bist.'
		}
	],
	privacyTitle: 'Nichts verlässt diesen Tab, außer du willst es',
	privacyOne:
		'Die Dateien werden von einem Worker innerhalb dieser Seite gelesen — kein Upload, keine Analyse, nichts, was das Gerät verlässt. Was die App aufbewahrt, bewahrt sie hier auf: Eine Kopie landet im Speicher dieses Browsers, damit ein Export wieder geöffnet werden kann, ohne die Dateien erneut abzulegen, und ein Klick entfernt sie. Deine Fahrzeug-Identifizierungsnummer steht in jeder Zeile des Exports; hier bleibt sie verdeckt, solange du sie nicht sehen willst.',
	privacyTwo:
		'Die Anmeldung ist die einzige Ausnahme, und sie ist freiwillig. Ein Konto kann eine Kopie eines Exports aufbewahren, damit sie diesen Browser überdauert, und eine einzelne Fahrt veröffentlichen, wenn du sie teilen willst. Es wird nichts dorthin kopiert, außer du bittest darum oder schaltest das automatische Kopieren ein. Mit dem Löschen des Kontos verschwindet jedes Byte.',
	openSource: 'Open Source unter der',
	licence: 'MIT-Lizenz',
	notAffiliated: '. Nicht mit XPeng verbunden.'
};
