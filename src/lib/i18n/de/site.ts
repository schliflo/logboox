import type { Messages } from '../en/index';

export const site: Messages['site'] = {
	features: 'Funktionen',
	faq: 'FAQ',
	guides: 'Ratgeber',
	readExport: 'Deinen Export lesen',
	tagline: 'Viewer für den XPeng-Datenexport: Fahrten, Laden & Fahrtenbuch',
	description:
		'LogbooX macht aus deinem XPeng-Export nach dem EU Data Act Fahrten, Ladevorgänge, Batteriezustand und Fahrstil. Gelesen in deinem Browser — nichts wird hochgeladen.'
};

export const featuresPage: Messages['featuresPage'] = {
	title: 'Funktionen',
	description:
		'Alles, was LogbooX aus einem XPeng-Export nach dem EU Data Act macht: Fahrten, Laden, Batterie, Fahrstil, ein Fahrtenbuch und ein freiwilliges Konto.',
	eyebrow: 'Funktionen',
	headline: 'Alles, was der Export verrät.',
	lede: 'Die Datei von XPeng enthält nur rohe Signale: keine Fahrten, keine Ladevorgänge, keine Zusammenfassung. All das wird in deinem Browser berechnet.',
	groups: [
		{
			title: 'Den Monat lesen',
			items: [
				{
					title: 'Jede Fahrt, Sekunde für Sekunde',
					body: 'Geschwindigkeit, Leistung und Ladestand jeder Fahrt, neben der Liste, sodass die nächste Fahrt nur einen Tastendruck entfernt ist. Wer über ein Diagramm fährt, liest denselben Moment in allen ab.'
				},
				{
					title: 'Ladevorgänge',
					body: 'Erkannt am Leistungssignal des Ladesteckers und über die Pausen hinweg verbunden, die das Auto beim Laden einlegt. Die Energie wird aus Akkuspannung und -strom berechnet, Rekuperation wird also nie für Laden gehalten.'
				},
				{
					title: 'Batterieverhalten',
					body: 'Verlust im Stand, die Reichweite, die eine volle Ladung wirklich bringt, und dein Ladelimit und Ladeplan — nur angezeigt, wenn die Daten sie hergeben.'
				},
				{
					title: 'Fahrstil',
					body: 'Jede Fahrsekunde nach den Kräften auf das Auto in einem g-g-Diagramm, daneben Histogramme für Geschwindigkeit und Pedal und deine stärkste Bremsung.'
				},
				{
					title: 'Türen und Reifen',
					body: 'Türöffnungen nach Wochentag und Stunde, die deinen Alltag ohne einen einzigen Standort nachzeichnen. Reifendruck je Rad, der dem Wetter folgt.'
				},
				{
					title: 'Was die Datei über dich weiß',
					body: 'Eine klare Übersicht, was der Export über deinen Alltag preisgibt — ganz ohne Kartenkoordinaten.'
				},
				{
					title: 'Signal-Explorer',
					body: 'Jede Spalte des Exports als Diagramm. Auch Signale, die die App nicht kennt, werden gelesen und lassen sich darstellen.'
				},
				{
					title: 'Jeder Zeitraum',
					body: 'Grenz alles auf die letzte Woche, einen Monat, ein Jahr oder eigene Daten ein. Fahrten- und Ladelisten gibt es als CSV, Tabelle oder PDF.'
				}
			]
		},
		{
			title: 'Fahrtenbuch führen',
			items: [
				{
					title: 'Wohin, wozu, und eine Notiz',
					body: 'Der Export enthält keine Standortdaten, also bekommt jede Fahrt von dir einen Start, ein Ziel, einen Zweck und einen Kommentar.'
				},
				{
					title: 'Einen Ort nur einmal tippen',
					body: 'Wo die letzte Fahrt endete, wird als Start der nächsten vorgeschlagen. Darüber hinaus kommen Vorschläge aus beschrifteten Fahrten: gleiche Strecke, gleiche Uhrzeit, der Rückweg.'
				},
				{
					title: 'Bereit zur Abgabe',
					body: 'Das Fahrtenbuch gibt es als CSV, Tabelle oder PDF für den angezeigten Zeitraum. Es ist ein Entwurf aus Rohsignalen, kein zertifiziertes Fahrtenbuch.'
				}
			]
		},
		{
			title: 'Jeden Monat behalten',
			items: [
				{
					title: 'In diesem Browser gespeichert',
					body: 'Jeder geöffnete Export wird komprimiert gespeichert — 5 bis 15 MB für einen Monat, der als 340 MB ankam — und öffnet sich in ein, zwei Sekunden wieder.'
				},
				{
					title: 'Eine durchgehende Aufzeichnung',
					body: 'Exporte desselben Autos werden zu einer Zeitleiste. Wo sich zwei überschneiden, gilt der neuere, und Tage ohne Export werden als nicht aufgezeichnet markiert.'
				},
				{
					title: 'Sichern und wiederherstellen',
					body: 'Ein ZIP enthält alles Gespeicherte. Leg es wieder auf der Startseite ab, in diesem Browser oder einem anderen.'
				},
				{
					title: 'Funktioniert offline',
					body: 'Nach dem ersten Besuch öffnet sich die App ohne Verbindung und lässt sich über das Browsermenü als App installieren.'
				}
			]
		},
		{
			title: 'Anmelden, wenn du willst',
			items: [
				{
					title: 'Exporte, die den Browser überdauern',
					body: 'Eine Kopie in deinem Konto, wiederhergestellt in jedem Browser, in dem du dich anmeldest. Kopiert wird nur, wenn du darum bittest oder das automatische Kopieren einschaltest.'
				},
				{
					title: 'Eine Erinnerung, bevor das Fenster schließt',
					body: 'XPeng gibt nur die letzten dreißig Tage heraus. Du bekommst eine E-Mail, bevor ein Monat endgültig verloren ist.'
				},
				{
					title: 'Eine API für deine eigenen Daten',
					body: 'Fahrten, Laden und Fahrtenbuch über HTTP, mit Tokens, die du selbst anlegst und widerrufst. Mit einem Beispiel für Home Assistant.'
				},
				{
					title: 'Eine Fahrt teilen',
					body: 'Veröffentliche eine Fahrt, einen Ladevorgang oder bis zu einem Monat Fahrten unter einem Link. Geteiltes enthält nie die Fahrzeug-Identifizierungsnummer.'
				},
				{
					title: 'Bestenlisten',
					body: 'Monatliche Listen für das schnellste Laden, die längste Fahrt und mehr. Veröffentlicht wird nur, was du freigibst; die ersten drei bekommen ein Abzeichen.'
				}
			]
		}
	],
	ctaTitle: 'Sieh es dir mit deinem eigenen Monat an',
	ctaBody: 'Noch kein Export? Der Demo-Monat zeigt jede Funktion an einem generierten Auto.'
};

export const faqPage: Messages['faqPage'] = {
	title: 'FAQ',
	description:
		'Fragen zu LogbooX: deinen XPeng-Datenexport bekommen, Datenschutz, Monate zusammenführen, das Fahrtenbuch und das freiwillige Konto.',
	eyebrow: 'FAQ',
	headline: 'Fragen und Antworten.',
	lede: 'Etwas fehlt?',
	contact: 'Schreib an',
	groups: [
		{
			title: 'Deine Daten bekommen',
			items: [
				{
					q: 'Wie bekomme ich meinen Export?',
					a: [
						'Melde dich unter xpeng.com/data-act mit deinem XPeng-Konto an, wähle alle Daten und die letzten 30 Tage und sende die Anfrage ab. Das ZIP steht meist nach wenigen Minuten in deinem Datencenter zum Download bereit, sieben Tage lang. [Der Ratgeber zur Anfrage](/guides/request-xpeng-data) führt Schritt für Schritt hindurch.'
					]
				},
				{
					q: 'Welche Dateien braucht LogbooX?',
					a: [
						'Die CSV-Dateien in diesem ZIP — Fahrstatus, Bedienung sowie Leistung & Energie. Lange Monate werden auf weitere Teile verteilt. Leg das ZIP so ab, wie es heruntergeladen wurde, oder alle Dateien auf einmal.'
					]
				},
				{
					q: 'Was steckt im XPeng-Datenexport?',
					a: [
						'Rohe Signale mit einem Messpunkt pro Sekunde, solange das Auto wach ist: Geschwindigkeit, Beschleunigung, Lenkung, Pedale, Motoren, Batterie, Laden, Türen, Fenster und Reifendruck. Standorte gibt es nicht. [Der Ratgeber zum Exportformat](/guides/xpeng-export-format) listet jede Datei und Spalte auf.'
					]
				},
				{
					q: 'Mit welchen XPeng-Modellen funktioniert es?',
					a: [
						'LogbooX liest das Exportformat statt einer Liste von Modellen: Heißen deine Dateien etwa DA…_dwd_opp_gdpr_veh_driving_status_di.csv, öffnet es sie, und den Modellnamen liest es aus der Datei selbst.'
					]
				},
				{
					q: 'Warum umfasst ein Export nur dreißig Tage?',
					a: [
						'XPeng gibt pro Anfrage die jeweils letzten dreißig Tage heraus, und ein älterer Monat lässt sich später nicht mehr anfordern. Frag jeden Monat erneut an, und LogbooX fügt die Exporte zu einer Aufzeichnung zusammen.'
					]
				},
				{
					q: 'Kann ich es ohne Export ausprobieren?',
					a: [
						'Ja. Der Demo-Monat wird in deinem Browser erzeugt, mit Pendelfahrten, einem Wochenendausflug und einem Schnellladestopp.'
					]
				}
			]
		},
		{
			title: 'Datenschutz',
			items: [
				{
					q: 'Wird mein Export irgendwohin hochgeladen?',
					a: [
						'Nein. Die Dateien werden von einem Worker innerhalb der Seite gelesen und im Speicher dieses Browsers aufbewahrt. Ohne Konto gibt es gar kein Ziel für einen Upload.'
					]
				},
				{
					q: 'Enthält der Export meine Standorte?',
					a: [
						'Nein, er enthält überhaupt keine Standortdaten. Deshalb fragt das Fahrtenbuch dich, wohin eine Fahrt ging. Die Tür- und Ladesignale verraten trotzdem viel über deinen Alltag; die App zeigt dir, was.'
					]
				},
				{
					q: 'Was ist mit der Fahrzeug-Identifizierungsnummer?',
					a: [
						'Sie steht in jeder Zeile des Exports. Die App zeigt sie nur verdeckt, solange du sie nicht sehen willst, und geteilte Links enthalten sie nie.'
					]
				},
				{
					q: 'Wie entferne ich meine Daten?',
					a: [
						'Jeder gespeicherte Export lässt sich mit einem Klick entfernen, und die Website-Daten-Einstellungen des Browsers löschen alles auf einmal. Mit dem Löschen eines Kontos verschwindet jedes Byte darin, auch geteilte Links.'
					]
				}
			]
		},
		{
			title: 'Nutzung',
			items: [
				{
					q: 'Kann ich mehrere Monate zusammenführen?',
					a: [
						'Ja. Exporte desselben Autos öffnen sich als eine Zeitleiste. Wo sich zwei überschneiden, gilt der neuere, und Lücken ohne Export werden als nicht aufgezeichnet markiert statt als Standtage gezählt.'
					]
				},
				{
					q: 'Sind meine Exporte beim nächsten Mal noch da?',
					a: [
						'Sie liegen in diesem Browser, und der ist kein sicherer Ort für die einzige Kopie: Der Speicher kann gelöscht werden, und Safari verwirft ihn nach einer Woche ohne Besuch. Leg ein Sicherungs-ZIP an oder melde dich an, um eine Kopie im Konto zu behalten.'
					]
				},
				{
					q: 'Kann ich das Fahrtenbuch für die Steuer verwenden?',
					a: [
						'Betrachte es als Entwurf. Es wird aus Rohsignalen abgeleitet und ist kein zertifiziertes Fahrtenbuch, also prüfe es, bevor es an jemanden geht, der sich darauf verlässt.'
					]
				},
				{
					q: 'Funktioniert es offline?',
					a: [
						'Ja, nach dem ersten Besuch. Auch gespeicherte Exporte öffnen sich ohne Verbindung, und der Browser kann die App in einem eigenen Fenster installieren.'
					]
				},
				{
					q: 'Warum fehlen mein Ladelimit oder mein Ladeplan?',
					a: [
						'Sie werden nur angezeigt, wenn die Daten sie eindeutig zeigen. Ein Auto, das immer voll lädt, hat kein Limit, das sich anzeigen ließe.'
					]
				}
			]
		},
		{
			title: 'Konten',
			items: [
				{
					q: 'Brauche ich ein Konto?',
					a: [
						'Nein. Alles, was einen Export liest, funktioniert ohne. Ein Konto ergänzt eine Kopie, die den Browser überdauert, eine Erinnerung vor Ablauf des Fensters, eine API, Links zum Teilen und die Bestenlisten.'
					]
				},
				{
					q: 'Wie funktioniert die Anmeldung?',
					a: [
						'Nur per E-Mail: Du bekommst einen Link, der einmal und fünfzehn Minuten lang gilt. Ein Passwort gibt es nicht.'
					]
				},
				{
					q: 'Ist ein Platz in der Bestenliste öffentlich?',
					a: [
						'Nur, wenn du ihn veröffentlichst. Ein Platz zeigt einen Namen deiner Wahl, das Automodell und die Werte — nie die genaue Uhrzeit.'
					]
				}
			]
		},
		{
			title: 'Über LogbooX',
			items: [
				{
					q: 'Was kostet es?',
					a: ['Nichts. LogbooX ist kostenlos und Open Source unter der MIT-Lizenz.']
				},
				{
					q: 'Was ist der EU Data Act?',
					a: [
						'Eine EU-Verordnung, die seit dem 12. September 2025 gilt und Nutzern vernetzter Produkte wie Autos das Recht auf die Daten gibt, die diese erzeugen — unentgeltlich und maschinenlesbar. [Der Ratgeber zum Data Act](/guides/eu-data-act-car-data) erklärt, was das für Fahrer bedeutet.'
					]
				},
				{
					q: 'Ist das eine App von XPeng?',
					a: [
						'Nein. LogbooX ist ein unabhängiges Projekt, nicht mit XPeng verbunden oder von XPeng unterstützt. Es liest den Export, den XPeng nach dem EU Data Act bereitstellt.'
					]
				}
			]
		}
	]
};
