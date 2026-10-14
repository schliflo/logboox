import type { Messages } from '../en/index';

export const guidesPage: Messages['guidesPage'] = {
	title: 'Ratgeber',
	description:
		'Ratgeber zum XPeng-Datenexport nach dem EU Data Act: Fahrzeugdaten anfordern, was die Dateien enthalten, deine Rechte nach dem Data Act und ein Fahrtenbuch führen.',
	eyebrow: 'Ratgeber',
	headline: 'Deine Fahrzeugdaten, erklärt.',
	lede: 'Was XPeng nach dem EU Data Act herausgibt, wie du es anforderst und was sich daraus ablesen lässt.',
	read: 'Ratgeber lesen',
	updated: 'Aktualisiert',
	inBrief: 'Kurz gesagt',
	contents: 'Auf dieser Seite',
	questions: 'Fragen',
	more: 'Weitere Ratgeber',
	home: 'Start',
	ctaTitle: 'Hast du deinen Export schon?',
	ctaBody:
		'Leg ihn auf der Startseite ab, und er wird zu Fahrten, Ladevorgängen, Batteriedaten und einem Fahrtenbuch — in deinem Browser gelesen, nie hochgeladen.'
};

export const guides: Messages['guides'] = [
	{
		slug: 'request-xpeng-data',
		title: 'XPeng-Daten anfordern',
		description:
			'Schritt für Schritt: So forderst du deine Fahrzeugdaten bei XPeng nach dem EU Data Act an, wie lange es dauert, was ankommt und wie du mehr als dreißig Tage sammelst.',
		headline: 'So forderst du deine XPeng-Fahrzeugdaten nach dem EU Data Act an',
		lede: 'Jeder in der EU verkaufte XPeng zeichnet auf, was er tut, einmal pro Sekunde. Der EU Data Act gibt dir das Recht auf eine Kopie. So bekommst du sie.',
		summary: [
			'Fordere die Daten unter [xpeng.com/data-act](https://www.xpeng.com/data-act) an. XPeng antwortet per E-Mail mit einem ZIP aus CSV-Dateien, meist innerhalb etwa einer Woche. Der Export umfasst nur die letzten dreißig Tage, also fordere ihn jeden Monat an, wenn du eine längere Aufzeichnung willst — [LogbooX](/) fügt aufeinanderfolgende Exporte zu einer Zeitleiste zusammen.'
		],
		sections: [
			{
				heading: 'Schritt für Schritt',
				body: ['Die Anfrage dauert ein paar Minuten. Das Warten ist der längere Teil.'],
				list: [
					'Öffne [xpeng.com/data-act](https://www.xpeng.com/data-act) und füll das Anfrageformular aus. Rechne damit, dass Angaben abgefragt werden, die dich und das Auto identifizieren, etwa deine E-Mail-Adresse und die Fahrzeug-Identifizierungsnummer (FIN) aus dem Fahrzeugschein.',
					'Bestätige die Anfrage, falls XPeng darum bittet. Heb die Bestätigungs-E-Mail auf: Sie belegt, wann du angefragt hast.',
					'Warte auf die Antwort. Meist dauert es etwa eine Woche. Die E-Mail enthält ein ZIP-Archiv oder verlinkt darauf.',
					'Lade das ZIP herunter. Entpacke und benenne die Dateien nicht um — an den Namen erkennt jedes Programm, welcher Datenstrom und welcher Teil eine Datei ist.',
					'Leg das ZIP auf [der LogbooX-Startseite](/) ab. Es wird in deinem Browser gelesen; nichts wird hochgeladen.'
				],
				ordered: true
			},
			{
				heading: 'Was ankommt',
				body: [
					'Bis zu drei CSV-Datenströme — Fahrstatus, Bedienung sowie Leistung & Energie — mit einem Messpunkt pro Sekunde, solange das Auto wach ist. Ein voller Monat ergibt etwa 340 MB und 3,6 Millionen Zeilen. Jeder Datenstrom ist auf eine Million Zeilen pro Datei begrenzt, längere Monate gehen also in Dateien mit der Endung `_part1`, `_part2` und so weiter über.',
					'Es gibt darin keine GPS-Position und auch keine Liste von Fahrten oder Ladevorgängen: nur rohe Signale. Alles andere muss daraus berechnet werden. Der [Ratgeber zum Exportformat](/guides/xpeng-export-format) listet jede Datei und Spalte auf.'
				]
			},
			{
				heading: 'Nur dreißig Tage: jeden Monat anfordern',
				body: [
					'Jede Anfrage umfasst ein gleitendes Fenster der letzten dreißig Tage. Ein Monat, der aus diesem Fenster gefallen ist, lässt sich später nicht mehr anfordern. Eine längere Historie bekommst du also nur, wenn du erneut anfragst, bevor es sich schließt.',
					'Eine Erinnerung im Kalender am selben Tag jedes Monats genügt. Mit einem kostenlosen LogbooX-Konto bekommst du eine E-Mail, bevor das Fenster deines letzten Exports abläuft. Exporte desselben Autos öffnen sich als eine durchgehende Aufzeichnung; wo sich zwei überschneiden, gewinnt der neuere.'
				]
			},
			{
				heading: 'Wenn die Anfrage länger dauert',
				body: [
					'Der Data Act verlangt, dass Daten ohne unangemessene Verzögerung bereitgestellt werden. Dauert eine Antwort deutlich länger als ein paar Wochen, schreib XPeng erneut an und nenne das Datum deiner Anfrage. Soweit die Daten dich als Person betreffen, gibt dir auch die DSGVO ein Auskunftsrecht, mit einer Frist von einem Monat, die nur mit Begründung verlängert werden darf. Der [Ratgeber zum EU Data Act](/guides/eu-data-act-car-data) erklärt, was dir zusteht.'
				]
			}
		],
		faq: [
			{
				q: 'Wie lange dauert eine Datenanfrage bei XPeng?',
				a: 'Meist etwa eine Woche von der Anfrage bis zur E-Mail.'
			},
			{
				q: 'Kostet der XPeng-Datenexport etwas?',
				a: 'Nein. Nach dem EU Data Act müssen Daten, die bei der Nutzung eines vernetzten Produkts entstehen, dir unentgeltlich bereitgestellt werden.'
			},
			{
				q: 'Kann ich Daten anfordern, die älter als dreißig Tage sind?',
				a: 'Nein. Jede Anfrage umfasst die letzten dreißig Tage. Fordere jeden Monat an, um eine lückenlose Aufzeichnung zu behalten.'
			},
			{
				q: 'Mit welchem Programm öffne ich den XPeng-Export?',
				a: 'Die Dateien sind einfache CSV-Dateien, jede Tabellenkalkulation öffnet sie also, aber ein Monat sind Millionen Zeilen. LogbooX liest das ganze ZIP im Browser und macht daraus Fahrten, Ladevorgänge, Batteriewerte und ein Fahrtenbuch.'
			}
		]
	},
	{
		slug: 'xpeng-export-format',
		title: 'XPeng-Exportformat',
		description:
			'Was im XPeng-Export nach dem EU Data Act steckt: die drei CSV-Datenströme, Dateinamen, Abtastrate, Größe und jedes Signal — Geschwindigkeit, Beschleunigung, Pedale, Motoren, Batterie, Türen, Fenster und Reifendruck.',
		headline: 'Der XPeng-Datenexport, Datei für Datei und Spalte für Spalte',
		lede: 'Eine Übersicht über die CSV-Dateien, die XPeng nach dem EU Data Act verschickt: wie sie heißen, wie sie aufgeteilt sind und was jede Spalte misst.',
		summary: [
			'Der Export besteht aus bis zu drei CSV-Datenströmen — `driving_status`, `driving_operation` und `driving_power_energy` — mit einer Zeile pro Sekunde, solange das Auto wach ist, über die letzten dreißig Tage. Jede Zeile trägt die FIN, das Modell, einen Zeitstempel und ein Datum. Standortdaten gibt es nicht. Ein Monat sind etwa 340 MB und 3,6 Millionen Zeilen.'
		],
		sections: [
			{
				heading: 'Dateinamen',
				body: [
					'Jede Datei ist nach der Anfrage-ID benannt, die mit `DA` beginnt, und nach dem Datenstrom, den sie enthält:',
					'`DA<anfrage-id>_dwd_opp_gdpr_veh_driving_status_di.csv`, `…_driving_operation_di.csv` und `…_driving_power_energy_di.csv`.',
					'Jede Datei enthält höchstens 1.000.000 Datenzeilen. Ein längerer Datenstrom geht in `_part1`, `_part2` und so weiter weiter. Die Datei ohne Endung ist die früheste, und die Teile müssen nach Zahl statt alphabetisch sortiert werden, damit `_part10` nach `_part9` kommt.'
				]
			},
			{
				heading: 'Spalten in jedem Datenstrom',
				body: ['Vier Spalten stehen in allen drei Datenströmen und verbinden sie:'],
				list: [
					'`vin` — die Fahrzeug-Identifizierungsnummer, in jeder Zeile.',
					'`vmodel` — die Modellbezeichnung.',
					'`timer` — der Zeitpunkt des Messpunkts.',
					'`ds` — die Datumspartition, aus der die Zeile exportiert wurde.'
				]
			},
			{
				heading: 'Bedienung',
				body: ['Was Auto und Fahrer tun:'],
				list: [
					'`esp_vehspd` — Geschwindigkeit, km/h.',
					'`esp_vehlongaccel`, `esp_vehlateralaccel` — Längs- und Querbeschleunigung, in g.',
					'`cdcu_totalodometer` — Kilometerstand, km.',
					'`eps_steeringangle`, `eps_steeringanglespd` — Lenkwinkel in Grad und Lenkgeschwindigkeit in Grad pro Sekunde.',
					'`ldcu_accpedalsig` — Stellung des Fahrpedals, %.',
					'`ldcu_brkpedalst` — Bremspedal getreten oder nicht.',
					'`ldcu_currentgearlev` — Fahrstufe: D, N, R oder P.'
				]
			},
			{
				heading: 'Leistung & Energie',
				body: ['Antrieb und Batterie:'],
				list: [
					'`ipuf_actrotspd`, `ipur_actrotspd` — Drehzahl von Front- und Heckmotor, U/min.',
					'`ipuf_acttorq`, `ipur_acttorq` — Drehmoment von Front- und Heckmotor, Nm.',
					'`ipuf_rotoracttemp`, `ipur_rotoracttemp` — Rotortemperatur vorn und hinten, °C.',
					'`bms_battvolt`, `bms_battcurr` — Akkuspannung (V) und -strom (A). Multipliziert ergeben sie die Leistung, die in die Batterie hinein- oder aus ihr herausfließt.',
					'`ldcu_chrgpwr` — Ladeleistung, kW.',
					'`ldcu_bms_soc_disp` — angezeigter Ladestand, %.',
					'`ldcu_dstbatdisp_dynamic` — geschätzte Reichweite, km.',
					'`bms_batttempmax_gb`, `bms_batttempmin_gb` — höchste und niedrigste Akkutemperatur, °C, mit den Nummern der Sensoren, die sie gemessen haben.'
				]
			},
			{
				heading: 'Fahrstatus',
				body: ['Die Karosserie:'],
				list: [
					'Vier Türsignale: Fahrer, Beifahrer, hinten links und hinten rechts — offen oder geschlossen.',
					'Vier Fensterpositionen, % geöffnet.',
					'Der Heckklappenöffner.',
					'Reifendruck je Rad: vorn links, vorn rechts, hinten links, hinten rechts.'
				]
			},
			{
				heading: 'Stolperfallen beim Selbstauswerten',
				body: [
					'Manche Spalten nutzen feste Codes für „Signal nicht verfügbar“ statt eines Messwerts — eine Geschwindigkeit von 255 km/h oder eine Reichweite von 1.638 km sind Platzhalter, keine Messungen. Ungefiltert machen sie Diagramme unlesbar, filtere sie also zuerst heraus.',
					'Das Auto misst nur, solange es wach ist. Lücken zwischen Zeilen sind Schlafphasen, keine fehlenden Daten, und Ladevorgänge werden oft von kurzen Schlafphasen unterbrochen, die wieder zusammengefügt werden müssen.',
					'Nichts im Export ist eine Fahrt oder ein Ladevorgang: Beides muss aus den Signalen erkannt werden. [LogbooX](/features) erledigt das im Browser, und sein Signal-Explorer zeichnet jede Spalte — auch solche, die er noch nie gesehen hat.'
				]
			}
		],
		faq: [
			{
				q: 'Enthält der XPeng-Datenexport GPS-Standorte?',
				a: 'Nein. Es gibt darin überhaupt keine Standortdaten. Tür-, Lade- und Fahrzeiten verraten trotzdem viel über den Alltag.'
			},
			{
				q: 'Wie groß ist der XPeng-Datenexport?',
				a: 'Etwa 340 MB und 3,6 Millionen Zeilen für einen vollen Monat, bei einem Messpunkt pro Sekunde, solange das Auto wach ist.'
			},
			{
				q: 'Was bedeutet _part1 im Dateinamen?',
				a: 'Jeder Datenstrom wird alle eine Million Zeilen geteilt. Die Datei ohne Endung ist der erste Teil, dann folgen _part1, _part2 und so weiter.'
			}
		]
	},
	{
		slug: 'eu-data-act-car-data',
		title: 'Der EU Data Act und dein Auto',
		description:
			'Was der EU Data Act für Autobesitzer bedeutet: dein Recht auf die Daten, die dein vernetztes Auto erzeugt, kostenlos und maschinenlesbar, und das Recht, sie mit einem Dienst deiner Wahl zu teilen.',
		headline: 'Der EU Data Act und dein Auto: was du verlangen kannst',
		lede: 'Seit September 2025 haben alle, die in der EU ein vernetztes Auto nutzen, ein Recht auf die Daten, die es erzeugt. Was das bedeutet, in einfachen Worten.',
		summary: [
			'Der EU Data Act — Verordnung (EU) 2023/2854 — gilt seit dem 12. September 2025. Er gibt Nutzern eines vernetzten Produkts, etwa eines Autos, das Recht auf Zugang zu den Daten, die bei seiner Nutzung entstehen, unentgeltlich, in einem strukturierten, gängigen und maschinenlesbaren Format, und das Recht, sie an einen Dritten ihrer Wahl weitergeben zu lassen. XPeng setzt das mit einem Anfrageformular unter [xpeng.com/data-act](https://www.xpeng.com/data-act) um.'
		],
		sections: [
			{
				heading: 'Was der Data Act ist',
				body: [
					'Der Data Act ist eine EU-Verordnung darüber, wer die Daten nutzen darf, die vernetzte Geräte erzeugen. Vorher gehörten die Daten eines Autos praktisch dem Hersteller: Sie wanderten auf dessen Server, und Fahrer sahen nur, was eine App zeigen wollte. Der Data Act macht die Nutzer des Produkts zu einer Partei mit eigenen Rechten.',
					'Als Verordnung gilt er unmittelbar in jedem Mitgliedstaat, ohne dass nationale Gesetze ihn erst umsetzen müssen.'
				]
			},
			{
				heading: 'Deine Rechte als Fahrer',
				body: [
					'Für Daten, die bei der Nutzung eines vernetzten Autos entstehen, können Nutzer verlangen:'
				],
				list: [
					'Zugang zu den Daten, einfach und sicher, ohne unangemessene Verzögerung.',
					'Die Daten unentgeltlich.',
					'Ein umfassendes, strukturiertes, gängiges und maschinenlesbares Format — die CSV-Dateien von XPeng sind ein Beispiel.',
					'Die Weitergabe an einen Dritten deiner Wahl, etwa eine freie Werkstatt oder eine App.',
					'Für Produkte, die ab dem 12. September 2026 in Verkehr gebracht werden, eine Gestaltung, die die Daten standardmäßig zugänglich macht.'
				]
			},
			{
				heading: 'Data Act und DSGVO',
				body: [
					'Fahrzeugdaten sind oft auch personenbezogene Daten: Der Export trägt deine FIN in jeder Zeile, und die Zeiten, zu denen du fährst und lädst, beschreiben deinen Alltag. Soweit sie personenbezogen sind, gilt neben dem Data Act weiterhin die DSGVO, einschließlich deines Auskunftsrechts und deines Rechts auf Datenübertragbarkeit. Das eine ersetzt das andere nicht.'
				]
			},
			{
				heading: 'Was XPeng bereitstellt',
				body: [
					'XPeng nimmt Anfragen unter [xpeng.com/data-act](https://www.xpeng.com/data-act) entgegen und antwortet mit einem ZIP aus CSV-Dateien über die letzten dreißig Tage, ein Messpunkt pro Sekunde. Der [Ratgeber zur Anfrage](/guides/request-xpeng-data) führt hindurch, und der [Ratgeber zum Exportformat](/guides/xpeng-export-format) listet auf, was in den Dateien steht.'
				]
			},
			{
				heading: 'Die Daten nutzen',
				body: [
					'Rohe Signale sind ein Recht auf dem Papier, bis etwas sie liest. [LogbooX](/) ist ein kostenloser Open-Source-Reader für den XPeng-Export, der im Browser läuft: Er findet Fahrten und Ladevorgänge, misst Batterieverhalten und Fahrstil und entwirft ein Fahrtenbuch — ohne die Daten irgendwohin zu senden. Er ist nicht mit XPeng verbunden.'
				]
			}
		],
		faq: [
			{
				q: 'Seit wann gilt der EU Data Act?',
				a: 'Seit dem 12. September 2025. Manche Pflichten, etwa Produkte so zu gestalten, dass ihre Daten standardmäßig zugänglich sind, gelten für Produkte, die ab dem 12. September 2026 in Verkehr gebracht werden.'
			},
			{
				q: 'Darf ein Autohersteller Geld für meine eigenen Daten verlangen?',
				a: 'Nein. Daten, die Nutzern eines vernetzten Produkts nach dem Data Act bereitgestellt werden, sind für sie unentgeltlich.'
			},
			{
				q: 'Gilt der Data Act auch außerhalb der EU?',
				a: 'Er erfasst vernetzte Produkte, die in der EU in Verkehr gebracht werden, und ihre Nutzer in der EU, egal wo der Hersteller sitzt.'
			}
		]
	},
	{
		slug: 'xpeng-driving-logbook',
		title: 'XPeng-Fahrtenbuch',
		description:
			'So entwirfst du ein Fahrtenbuch aus deinem XPeng-Datenexport: Fahrten mit Zeiten und Strecken automatisch erkannt, Orte und Zwecke von dir ergänzt, als PDF, Tabelle oder CSV heruntergeladen.',
		headline: 'Ein Fahrtenbuch aus deinem XPeng, entworfen aus seinen eigenen Daten',
		lede: 'Der Export zeichnet jede Fahrt sekundengenau auf. Was er nicht weiß: wohin du gefahren bist und warum. Ergänze das, und du hast den Entwurf eines Fahrtenbuchs.',
		summary: [
			'[LogbooX](/) erkennt jede Fahrt in deinem XPeng-Export — Beginn, Ende, Strecke und Kilometerstände — und lässt dich zu jeder einen Start, ein Ziel, einen Zweck und eine Notiz ergänzen. Das Fahrtenbuch lässt sich für jeden Zeitraum als PDF, Tabelle oder CSV herunterladen. Es ist ein Entwurf aus rohen Signalen, kein anerkanntes Fahrtenbuch.'
		],
		sections: [
			{
				heading: 'Was der Export liefert',
				body: [
					'Jede Fahrt wird aus Geschwindigkeit, Fahrstufe und Kilometerstand erkannt, die einmal pro Sekunde gemessen werden. Beginn und Ende, Strecke und Kilometerstand an beiden Enden kommen also direkt vom Auto. Das ist der Teil eines Fahrtenbuchs, der von Hand mühsam ist, und es ist der Teil, den das Auto richtig hat.'
				]
			},
			{
				heading: 'Was du ergänzt',
				body: [
					'Der Export enthält keine Standortdaten, Orte und Zwecke kommen also von dir. LogbooX hält das Tippen gering:'
				],
				list: [
					'Wo die letzte Fahrt endete, wird als Start der nächsten vorgeschlagen.',
					'Bereits genutzte Orte werden aus passenden Fahrten vorgeschlagen: gleiche Strecke, gleiche Uhrzeit oder der Rückweg.',
					'Fahrten ohne Ort stehen auf der Startseite, sodass sich Lücken leicht schließen lassen.',
					'Der Zweck — dienstlich, Arbeitsweg oder privat — ist eine einzige Auswahl, mit Platz für einen Kommentar.'
				]
			},
			{
				heading: 'Herunterladen',
				body: [
					'Grenz das Dashboard auf den nötigen Zeitraum ein — einen Monat, ein Quartal, ein Jahr oder selbst gewählte Daten — und lade das Fahrtenbuch als PDF zum Weitergeben, als Tabelle zum Bearbeiten oder als CSV für andere Software herunter. Monate fügen sich zu einer Aufzeichnung zusammen, solange du den Export jeden Monat anforderst: siehe [den Ratgeber zur Anfrage](/guides/request-xpeng-data).'
				]
			},
			{
				heading: 'Gilt es für das Finanzamt?',
				body: [
					'Behandle es als Entwurf. Steuerbehörden stellen an ein Fahrtenbuch meist Anforderungen, die eine nachträglich aus rohen Signalen erzeugte Datei allein nicht erfüllt. In Deutschland etwa erwartet das Finanzamt, dass ein Fahrtenbuch zeitnah geführt wird und sich nachträglich nicht unbemerkt ändern lässt — eine Tabelle ist das nicht. Nutze den Entwurf, um dein eigentliches Fahrtenbuch zu füllen oder zu prüfen, und frag eine Steuerberatung, was deine Behörde akzeptiert.'
				]
			}
		],
		faq: [
			{
				q: 'Kann ich aus meinen XPeng-Daten ein Fahrtenbuch erstellen?',
				a: 'Ja, als Entwurf. Fahrten mit Zeiten, Strecken und Kilometerständen werden automatisch erkannt; Orte und Zwecke ergänzt du.'
			},
			{
				q: 'Warum fragt das Fahrtenbuch, wohin ich gefahren bin?',
				a: 'Weil der XPeng-Export keine Standortdaten enthält. Start und Ziel müssen von dir kommen, mit Vorschlägen aus Fahrten, die du schon beschriftet hast.'
			},
			{
				q: 'Akzeptiert das Finanzamt das Fahrtenbuch von LogbooX?',
				a: 'Nicht allein. Es ist aus rohen Signalen abgeleitet und lässt sich bearbeiten, was die meisten steuerlichen Regeln für Fahrtenbücher nicht zulassen. Nutze es als Entwurf und sprich mit einer Steuerberatung.'
			}
		]
	}
];
