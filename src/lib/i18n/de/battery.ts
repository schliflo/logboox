import type { Messages } from '../en/index';

export const battery: Messages['battery'] = {
	fullRange: 'Reichweite bei voller Ladung',
	fullRangeDetail: (min, max) => `Meist ${min}–${max} km, nach der Schätzung des Autos selbst`,
	lostParked: 'Verlust im Stand',
	lostParkedDetail: (count, hours) => `Über ${count} lange Standzeiten, zusammen ${hours} Stunden`,
	packTemp: 'Akkutemperatur',
	spreadDetail: (spread) => `Der größte Unterschied innerhalb des Akkus lag bei ${spread} °C`,
	socUsed: 'Genutzter Ladebereich',
	socUsedDetail: 'Der Bereich, in dem die Batterie in diesem Monat tatsächlich lebte',
	monthOfCharge: 'Ein Monat Ladestand',
	monthOfChargeHint:
		'Jedes Entladen und Aufladen. Die Linie bricht ab, wo das Auto schlief — dann zeichnet es nichts auf, und eine Linie über die Lücke würde etwas anderes behaupten.',
	charge: 'Ladestand',
	predicted: 'Prognostizierte Reichweite',
	predictedHint: 'Was das Auto dir als Restreichweite angezeigt hat.',
	range: 'Reichweite',
	packTempHint:
		'Wärmster und kühlster Teil der Batterie. Der Abstand zeigt, wie der Akku arbeitet, um gleichmäßig zu bleiben.',
	warmest: 'Wärmster',
	coolest: 'Kühlster',
	standing: 'Ladungsverlust im Stand',
	standingHint:
		'Lange Zeiträume ohne Fahren und ohne Laden. Ein geparktes Auto betreibt weiter seine Systeme, und der Ladestand sinkt still.',
	parkedFrom: 'Geparkt ab',
	for: 'Dauer',
	lost: 'Verlust'
};
