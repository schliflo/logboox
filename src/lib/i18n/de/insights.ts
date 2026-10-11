import type { Messages } from '../en/index';

export const insights: Messages['insights'] = {
	privacy: 'Datenschutz',
	knows: 'Was diese Datei über dich weiß',
	knowsHint: 'Keine einzige Kartenkoordinate, und trotzdem verrät sie deinen Alltag.',
	readAccount: 'Den ganzen Bericht lesen',
	gripEyebrow: 'Fahrstil · wie viel Haftung du genutzt hast',
	gentle: 'Ein schmales Kreuz: Du bremst und lenkst selten gleichzeitig stark',
	combined: 'Du bremst oder beschleunigst oft in Kurven',
	combinedShare: (share, g) =>
		`${share} deiner Fahrzeit kombinierte mehr als ${g} g Querkraft mit Bremsen oder Beschleunigen.`,
	hardestStop: 'Stärkste Bremsung',
	hardestLaunch: 'Stärkster Antritt',
	hardestCorner: 'Stärkste Kurve',
	drivingInFull: 'Fahrstil im Detail',
	speeds: 'Deine Geschwindigkeiten',
	topSpeed: (speed, above) => `Höchstens ${speed} km/h, über 100 für ${above}`,
	ofMoving: (time) => `Von ${time} in Bewegung.`,
	speedMoving: 'Geschwindigkeit in Bewegung',
	doorsTyres: 'Türen & Reifen',
	doorsBusiest: (hour) => `Türen gehen am häufigsten um ${hour} auf`,
	doorsNever: (from, to) => `, und nie zwischen ${from} und ${to}`,
	doorsFallback: 'Tür- und Reifenwerte, Tag für Tag',
	tyresBetween: (min, max) => `Reifen zwischen ${min} und ${max} kPa im Zeitraum.`,
	seeWeek: 'Die Woche so sehen, wie die Türen sie sahen',
	asides: 'Dinge, nach denen du nicht gefragt hättest',
	goFurther: 'Weiter erkunden',
	explorer: 'Signal-Explorer',
	plotAny: (count) => `Jedes der ${count} Rohsignale darstellen`,
	openExplorer: 'Explorer öffnen'
};

export const privacyPage: Messages['privacyPage'] = {
	knows: 'Was diese Datei über dich weiß',
	noCoordinate: 'Keiner der folgenden Befunde brauchte auch nur eine Kartenkoordinate.',
	identifier: 'Deine Kennung',
	identifierHint: 'Die Fahrzeug-Identifizierungsnummer steht in jeder Zeile jeder Datei.',
	hide: 'Verbergen',
	show: 'Anzeigen',
	model: (model) => `Modell ${model}`,
	vinDetail: (times, size) =>
		`${times}-mal in deinem Export wiederholt, macht sie allein etwa ${size} der Datei aus. Sie identifiziert das Auto und über die Zulassung seinen Halter. Wenn du einen Screenshot deiner Daten teilst, ist das das Feld, das du entfernen solltest — deshalb ist es hier standardmäßig verdeckt.`,
	curiosities: 'Kuriositäten in der Datei selbst',
	curiositiesHint: 'Was der Export darüber verrät, wie er zusammengesetzt wurde.',
	unsorted: 'Dateien in falscher Reihenfolge',
	unsortedDetail:
		'Ein Block eines früheren Tages wurde nach einem späteren geschrieben. Die Zeilen werden hier sortiert, bevor irgendetwas gemessen wird; in Dateireihenfolge gelesen, käme ein Tag doppelt vor.',
	timelines: 'Zeitachsen',
	merged: 'Zusammengeführt',
	mergedDetail:
		'Die drei Dateien hatten nicht dieselben Zeitstempel, also wurden sie über die Zeit verbunden, statt anzunehmen, dass sie Zeile für Zeile übereinstimmen.',
	handling: 'Wie diese App damit umgeht',
	handlingOne:
		'Deine Dateien wurden von einem Worker in diesem Browser-Tab gelesen. Es gibt keinen Server, der sie empfängt: Die App besteht aus statischen Dateien, und nachdem sie geladen sind, wird nichts irgendwohin geschickt. Du kannst das prüfen — öffne die Netzwerkansicht deines Browsers und lade mit geladenen Daten neu, oder trenne die Verbindung ganz und nutze die Seite weiter.',
	keptMany: (samples) =>
		`Jeder der Exporte hinter diesen ${samples} Messpunkten ist im Speicher dieses Browsers abgelegt, sodass sie ohne die Dateien wieder geöffnet werden können.`,
	keptOne: (samples) =>
		`Eine Kopie der ${samples} Messpunkte vor dir liegt im Speicher dieses Browsers, sodass der Export ohne die Dateien wieder geöffnet werden kann.`,
	staysHere:
		'Sie bleibt auf diesem Gerät — woanders kann sie gar nicht hin. Die Startseite listet alles Gespeicherte und entfernt jedes Stück mit einem Klick, und die Website-Daten-Einstellungen deines Browsers löschen alles auf einmal.',
	windowMany: (sources, days) =>
		`Diese ${sources} Exporte decken zusammen ${days} Tage ab. Jeder, den XPeng schickt, umfasst die jeweils letzten dreißig Tage — sie aufzubewahren ist die einzige Möglichkeit, eine längere Aufzeichnung zu haben.`,
	windowOne: (days) =>
		`Der Export umfasst die letzten ${days} Tage. Fordere den nächsten an, bevor dieses Fenster verstreicht, und öffne sie dann zusammen: Nebeneinander aufbewahrt werden sie zu einer durchgehenden Aufzeichnung — mehr, als du je auf einmal bekommen hast.`
};
