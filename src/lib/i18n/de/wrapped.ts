import type { Messages } from '../en/index';

export const wrapped: Messages['wrapped'] = {
	title: 'Dein Monat in Daten',
	description: 'Die Highlights eines Fahrmonats, direkt aus deinem eigenen XPeng-Export gelesen.',
	exploreAll: 'Alles erkunden',
	exploreHint: 'Fahrten, Laden, Batterie, Fahrstil und die Rohsignale',
	keepGoing: 'Weiter',
	toDashboard: 'LogbooX — zum Dashboard',
	yourHighlights: 'Deine Highlights',
	demonstration: 'Demodaten',
	skip: 'Zum Dashboard springen',
	goTo: (what) => `Gehe zu ${what}`
};
