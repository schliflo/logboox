import type { Messages } from '../en/index';

export const doorsPage: Messages['doorsPage'] = {
	doors: {
		ldcu_driverdoorajarst: 'Fahrer',
		rdcu_psngrdoorajarst: 'Beifahrer',
		ldcu_rldoorajarst: 'Hinten links',
		rdcu_rrdoorajarst: 'Hinten rechts'
	},
	wheels: ['Vorn links', 'Vorn rechts', 'Hinten links', 'Hinten rechts'],
	schedule: 'Dein Auto kennt deinen Tagesablauf',
	scheduleHint:
		'Jede Türöffnung, nach Wochentag und Stunde. Um die Form einer Woche zu sehen, braucht es keine Standortdaten: Das hier ist nur, welche Tür wann aufging.',
	openings: 'Türöffnungen',
	openingsCount: (count) => `${count} Öffnungen`,
	recorded: 'Aufgezeichnete Öffnungen',
	busiestHour: 'Häufigste Stunde',
	neverBetween: 'Kein einziges Mal zwischen',
	quietDetail: (hours) => `${hours} Stunden völlige Ruhe, jeden Tag`,
	longestOpen: 'Am längsten offen',
	aDoor: 'Eine Tür',
	doorName: (door) => (door.startsWith('Hinten') ? `Tür ${door.toLowerCase()}` : `${door}tür`),
	rearNote:
		'Wenn hintere Türen aufgehen, saß noch jemand im Auto. Zusammen mit den Uhrzeiten ist das ein Monat voller Kommen und Gehen eines Haushalts, sekundengenau aufgezeichnet — von einem Signal, das eigentlich nur vor einer offenen Tür warnen soll.',
	tyres: 'Reifendruck und das Wetter',
	tyresHint:
		'Tagesmedian für jedes Rad. Der Druck folgt der Lufttemperatur, das ist also nebenbei eine Aufzeichnung, wie warm der Monat war.',
	pressureRange: 'Druckbereich',
	pressureSteps: 'In Schritten von 2,75 kPa gemeldet, deshalb sehen die Linien aus wie Treppen',
	change: 'Veränderung im Monat',
	front: 'kPa vorn',
	rear: (value) => `Hinten ${value} kPa`,
	tracks: 'Folgt der Temperatur',
	tracksDetail: 'Korrelation mit der Batterietemperatur, die der Außenluft folgt',
	empty: 'Signale, die dein Auto nie befüllt hat',
	emptyHint: 'Diese Spalten stehen in jeder Zeile des Exports und sind in allen leer.',
	emptyNote:
		'Der Export nutzt ein Schema für jedes Modell, das XPeng verkauft, also meldet ein Auto Leerstellen überall dort, wo es die Hardware nicht hat. Fensterpositionen und der Heckklappenöffner stehen für Fahrzeuge in der Datei, die sie melden; deines tut es nicht.'
};

export const drivingPage: Messages['drivingPage'] = {
	hardestBraking: 'Stärkste Bremsungen',
	hardestAcceleration: 'Stärkste Beschleunigungen',
	fastest: 'Schnellste Momente',
	topSpeed: 'Höchstgeschwindigkeit',
	hardestStop: 'Stärkste Bremsung',
	emergency: 'Über 0,6 g ist eine Notbremsung',
	hardestLaunch: 'Stärkster Antritt',
	fullThrottle: 'Anfahren mit Vollgas',
	above100: (speed) => `Zeit über ${speed}`,
	ofMoving: (time) => `Von ${time} in Bewegung`,
	grip: 'Wie viel Haftung du genutzt hast',
	gripHint:
		'Jede Sekunde Fahrt, eingeordnet nach den Kräften auf das Auto: Bremsen und Beschleunigen nach oben und unten, Kurven nach links und rechts. Vorsichtiges Fahren füllt ein schmales Kreuz, sportliches Fahren einen Kreis.',
	speeds: 'Die Geschwindigkeiten, die du wirklich fährst',
	speedsHint: 'Zeit bei jeder Geschwindigkeit, ohne Stillstand.',
	speedMoving: 'Geschwindigkeit in Bewegung',
	pedal: 'Wie weit du das Pedal trittst',
	pedalHint: 'Fahrpedalstellung, sobald es überhaupt getreten wurde.',
	pedalLabel: 'Fahrpedalstellung',
	atSpeed: (speed) => `bei ${speed}`
};
