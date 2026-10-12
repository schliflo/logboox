import type { FactCatalog } from '../en/facts';

export const facts: FactCatalog = {
	distance: (p, f) => ({
		kicker:
			p.sources > 1
				? `Über ${p.sources} Exporte, in ${p.recordedDays} Tagen bist du gefahren`
				: `In ${p.recordedDays} Tagen bist du gefahren`,
		value: f.num(p.km),
		unit: 'km',
		detail: `Auf ${p.trips} Fahrten, im Schnitt ${f.num(p.km / Math.max(1, p.recordedDays), 1)} km am Tag.`
	}),
	'time-driving': (p, f) => ({
		kicker: 'Zeit am Steuer',
		value: f.duration(p.seconds),
		detail: `Das sind ${f.num(p.share * 100, 1)} % der aufgezeichneten Zeit. Den Rest hat das Auto geparkt verbracht.`
	}),
	'top-speed': (p, f) => ({
		kicker: 'Deine Höchstgeschwindigkeit',
		value: f.num(p.speed),
		unit: 'km/h',
		detail: `Erreicht am ${f.when(p.time)}.`
	}),
	'longest-trip': (p, f) => ({
		kicker: 'Längste einzelne Fahrt',
		value: f.num(p.km),
		unit: 'km',
		detail: `${f.duration(p.seconds)} am ${f.when(p.time)}.`
	}),
	'hardest-brake': (p, f) => ({
		kicker: 'Stärkste Bremsung',
		value: f.num(p.g, 2),
		unit: 'g',
		detail: Number.isFinite(p.speed)
			? `Aus ${f.num(p.speed)} km/h am ${f.when(p.time)}. Alles über 0,6 g ist eine Notbremsung.`
			: `Am ${f.when(p.time)}.`
	}),
	'energy-charged': (p, f) => ({
		kicker: 'Geladene Energie',
		value: f.num(p.kwh),
		unit: 'kWh',
		detail: `In ${p.sessions} Ladevorgängen.`
	}),
	'departure-rhythm': (p, f) => ({
		kicker: 'Meistens fährst du los um',
		value: f.hour(p.hour),
		detail: `${p.count} deiner ${p.trips} Fahrten begannen in dieser Stunde. Die früheste um ${f.hour(p.earliest)}, die späteste um ${f.hour(p.latest)}.`
	}),
	'commute-shape': (p) => ({
		kicker: 'Fahrten, die nach Arbeitsweg aussehen',
		value: `${p.count}`,
		unit: `von ${p.trips}`,
		detail:
			'Zwei klare Spitzen — morgens hin, abends zurück — mit ruhigen Stunden dazwischen. Die Form einer Arbeitswoche steckt in den Daten, ohne dass irgendwer aufgezeichnet hätte, wohin du gefahren bist.'
	}),
	'scheduled-charging': (p, f) => ({
		kicker: 'Dein Laden beginnt um',
		value: f.hour(p.hour),
		detail: `${p.count} Ladevorgänge begannen in dieser Stunde. So viel Regelmäßigkeit bedeutet einen Ladetimer, keine Gewohnheit — wahrscheinlich ein günstiger Nachttarif.`
	}),
	'plug-in-habit': (p, f) => ({
		kicker: 'Am häufigsten steckst du ein um',
		value: f.hour(p.hour),
		detail: `${p.count} von ${p.sessions} Ladevorgängen begannen um diese Zeit. Über den Tag verteilt statt auf eine feste Uhrzeit — also eine Gewohnheit, kein Timer.`
	}),
	'charge-limit': (p) => ({
		kicker: 'Du hörst auf zu laden bei',
		value: `${p.limit}`,
		unit: '%',
		detail:
			'Immer wieder an derselben Stelle aufzuhören heißt: Im Auto ist ein Ladelimit eingestellt. Einen Lithium-Akku nicht ganz voll zu laden ist das Einfachste, was du für seine Lebensdauer tun kannst.'
	}),
	'ac-only': (p, f) => ({
		kicker: 'Nie schnellgeladen',
		value: f.num(p.maxKw, 1),
		unit: 'kW Spitze',
		detail:
			'Jeder Ladevorgang in diesem Zeitraum lief über das AC-Bordladegerät. Das Auto könnte weit mehr, hat es aber nie gebraucht — ein Zeichen, dass dein Laden bequem in die Standzeiten passt.'
	}),
	'idle-days': (p, f) => ({
		kicker: 'Tage, an denen das Auto stand',
		value: `${p.count}`,
		detail: `${p.days.map(f.day).join(', ')}${p.count > p.days.length ? ' und weitere' : ''}. Auch ein geparktes Auto schreibt ein lückenloses Protokoll im Sekundentakt.`
	}),
	'busiest-day': (p, f) => ({
		kicker: 'Dein fahrintensivster Tag',
		value: f.num(p.km),
		unit: 'km',
		detail: `${f.day(p.day)}, mit ${p.trips} Fahrten und ${f.duration(p.seconds)} am Steuer.`
	}),
	'phantom-drain': (p, f) => ({
		kicker: 'Ladungsverlust im Stand',
		value: f.num(p.perDay, 1),
		unit: '%/Tag',
		detail: `Gemessen über ${p.periods} Zeiträume, in denen das Auto unberührt stand. Selbst im Schlaf hält es seine Systeme am Leben.`
	}),
	'implied-range': (p, f) => ({
		kicker: 'Deine echte Reichweite mit voller Ladung',
		value: f.num(p.km),
		unit: 'km',
		detail: `Hochgerechnet aus der Prognose des Autos selbst. Sie lag je nach Wetter und Fahrweise zwischen ${f.num(p.min)} und ${f.num(p.max)} km.`
	}),
	'door-rhythm': (p, f) => ({
		kicker: 'Türen geöffnet',
		value: f.num(p.count),
		unit: 'Mal',
		detail: `Am häufigsten um ${f.hour(p.busiestHour)}${
			p.quiet
				? `, und kein einziges Mal in den ${p.quiet.hours} Stunden zwischen ${f.hour(p.quiet.from)} und ${f.hour(p.quiet.to)}`
				: ''
		}. Jedes Ein- und Aussteigen ist sekundengenau festgehalten.`
	}),
	'sample-count': (p, f) => ({
		kicker: 'Aufgezeichnete Momente',
		value: f.num(p.samples),
		detail: `Ein Messpunkt pro Sekunde, für ${f.num(p.coverage * 100)} % der aufgezeichneten Zeit. Die Lücken sind die Zeiten, in denen das Auto schlief — dann protokolliert es nicht, statt Nullen zu schreiben.`
	}),
	'empty-columns': (p, f) => ({
		kicker: 'Leer gelieferte Signale',
		value: `${p.count}`,
		detail: `${p.keys.map(f.column).join(', ')}${p.count > p.keys.length ? ' und andere' : ''} stehen in jeder Zeile der Datei und sind in allen leer. Der Export nutzt ein Schema für die ganze Flotte, dein Auto hat in diesen Spalten einfach nichts zu sagen.`
	}),
	'duplicate-rows': (p, f) => ({
		kicker: 'Doppelt gelieferte Zeilen',
		value: f.num(p.count),
		detail:
			'Identische Zeilen direkt hintereinander — der Fingerabdruck einer Datenpipeline, die Pakete erneut sendet, wenn sie nicht sicher ist, ob eine Lieferung angekommen ist. Als echt gezählt würden sie jede Summe aufblähen.'
	}),
	'undated-rows': (p, f) => ({
		kicker: 'Zeilen ohne brauchbare Zeit',
		value: f.num(p.count),
		detail:
			'Vor 2015 gestempelt, Jahre vom Rest entfernt oder ganz ohne Datum, meist weil die Uhr des Autos nicht gestellt war. Sie bleiben außen vor. Behalten würden sie jedes Diagramm über die Jahre dazwischen strecken.'
	}),
	'beijing-time': () => ({
		kicker: 'Dein Tag beginnt um',
		value: '18:00',
		detail:
			'Die Datei führt neben jedem Zeitstempel eine Datumsspalte, und die springt um Mitternacht Pekinger Zeit um — bei dir am frühen Abend. Nach dieser Spalte gruppiert, landet eine Abendfahrt am nächsten Tag. Diese App ignoriert sie und arbeitet mit den Zeitstempeln.'
	}),
	'pack-spread': (p, f) => ({
		kicker: 'Größter Temperaturunterschied',
		value: f.num(p.spread),
		unit: '°C',
		detail: `Zwischen dem wärmsten und dem kühlsten Teil der Batterie, am ${f.when(p.time)}. Der Akku meldet, welcher Sensor welcher war — aber nicht, wo im Auto sie sitzen.`
	}),
	'tyre-weather': (p, f) => ({
		kicker: 'Deine Reifen folgen dem Wetter',
		value: f.num(p.correlation, 2),
		unit: 'Korrelation',
		detail:
			'Der tägliche Reifendruck bewegt sich mit der Batterietemperatur, und die folgt der Außenluft. Dein Auto hat unbeabsichtigt ein Wettertagebuch geführt.'
	}),
	'no-gps': () => ({
		kicker: 'Enthaltene Standortdaten',
		value: 'Keine',
		detail:
			'In diesem Export steht keine einzige Koordinate. Ein vernetztes Auto weiß ganz offensichtlich, wo es war — Navigation, Ladekarten und Pannenhilfe hängen davon ab —, aber nichts davon steckt in den Daten, die du bekommen hast.'
	}),
	'vin-repetition': (p, f) => ({
		kicker: 'So oft steht deine FIN drin',
		value: f.num(p.rows),
		detail:
			'Deine Fahrzeug-Identifizierungsnummer wiederholt sich in jeder einzelnen Zeile jeder Datei. Sie identifiziert das Auto und über die Zulassung dich. Diese App hält sie verdeckt und schickt sie nirgendwohin.'
	}),
	'routine-exposure': (p) => ({
		kicker: 'Dein Alltag, rekonstruiert',
		value: `${p.count} Ereignisse`,
		detail:
			'Allein die Türöffnungen zeigen, wann du losfährst, wann du zurückkommst, ob jemand hinten saß und an welchen Tagen du gar nicht aus dem Haus bist. Für ein detailliertes Lebensbild braucht es keine Standortdaten.'
	}),
	'second-resolution': () => ({
		kicker: 'Aufzeichnungsauflösung',
		value: '1 Sekunde',
		detail:
			'Geschwindigkeit, Pedalstellung, Lenkwinkel und Bremse werden in jeder Sekunde erfasst, in der das Auto wach ist. Fein genug, um einzelne Fahrmanöver nachzuvollziehen, nicht nur Fahrten.'
	})
};
