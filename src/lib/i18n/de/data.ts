import type { Messages } from '../en/index';

export const dataPage: Messages['dataPage'] = {
	record: 'Deine Aufzeichnung',
	recordHint:
		'Alles, was du hinzufügst, wird Teil einer Zeitachse. Überschneidungen und Duplikate werden für dich erledigt.',
	addNewer: 'Neuere Daten hinzufügen',
	recorded: 'Aufgezeichnet',
	days: (count) => `${count} Tage`,
	trips: 'Fahrten',
	distance: 'Strecke',
	monthsCovered: (list) => `Abgedeckte Monate: ${list}`,
	lapsed: (date) =>
		`XPeng bewahrt nur dreißig Tage auf, was nach dem ${date} kam, ist also nicht mehr verfügbar. Fordere einen neuen Export an, um den nächsten Abschnitt zu beginnen.`,
	requestBefore: (date) =>
		`XPeng bewahrt nur dreißig Tage auf. Fordere den nächsten Export vor dem ${date} an, dann bleibt die Aufzeichnung lückenlos.`,
	requestAtXpeng: 'Bei XPeng anfordern',
	imported: (count) => `Importierte Dateien (${count})`,
	preferences: 'Einstellungen',
	price: 'Strompreis',
	priceHint: 'Wird für alle Kosten im Dashboard verwendet.',
	perKwh: 'pro kWh',
	currency: 'Währung',
	currencyHint: 'Für den Strompreis und alle Kosten.',
	distanceUnit: 'Entfernungseinheit',
	distanceUnitHint: 'Strecken, Geschwindigkeiten und Verbrauch, am Bildschirm und in Downloads.',
	kilometres: 'Kilometer',
	miles: 'Meilen',
	timeZone: 'Zeitzone',
	timeZoneHint:
		'Tage und Stunden werden in deiner eigenen Zone angezeigt. Die Datumsspalte des Exports wechselt um Mitternacht Pekinger Zeit, deshalb wird sie ignoriert.',
	language: 'Sprache',
	languageHint: 'Für die App selbst. Heruntergeladene Dateien bleiben auf Englisch.',
	showVin: 'Vollständige FIN anzeigen',
	showVinHint: 'Standardmäßig verdeckt, damit Screenshots gefahrlos geteilt werden können.',
	account: 'Konto',
	accountHint: 'Freiwillig. Alles oben funktioniert auch ohne.',
	accountDoes:
		'Bewahrt Kopien auf, schickt Erinnerungen, teilt Fahrten und stellt deine Daten per API bereit.',
	links: [
		{
			title: 'Kopien und Erinnerungen',
			body: 'Was das Konto aufbewahrt, automatisches Kopieren und wann du erinnert wirst.'
		},
		{
			title: 'Deine Plätze in der Bestenliste',
			body: 'Setz deinen Namen unter einen Platz oder zieh ihn wieder zurück.'
		},
		{
			title: 'Geteilte Links und API-Tokens',
			body: 'Was unter einem eigenen Link öffentlich ist, und die Schlüssel deiner Skripte.'
		}
	],
	signInPitch:
		'Melde dich per E-Mail-Link an, um eine Kopie zu behalten, die diesen Browser überdauert, eine Erinnerung zu bekommen, bevor die dreißig Tage bei XPeng ablaufen, und einen Platz in der Bestenliste einzunehmen. Nichts wird kopiert, außer du bittest darum.'
};
