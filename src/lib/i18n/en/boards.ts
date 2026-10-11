/** The community boards, as the UI names them. The server keeps its own English. */
export const boards = {
	items: {
		'peak-charge': {
			label: 'Fastest charge',
			blurb: 'The highest power a car actually took, at the plug.'
		},
		'biggest-charge': {
			label: 'Biggest charge',
			blurb: 'The most energy taken in one session, however long it took.'
		},
		'longest-drive': {
			label: 'Longest drive',
			blurb: 'The furthest anyone went in a single trip, without stopping long enough to end it.'
		},
		'efficient-drive': {
			label: 'Most efficient drive',
			blurb: 'The least energy used per hundred kilometres, over a trip long enough to mean it.'
		},
		'best-regen': {
			label: 'Best regeneration',
			blurb: 'The largest share of energy put back into the battery on the way.'
		},
		'hardest-launch': {
			label: 'Hardest launch',
			blurb: 'The strongest pull away from a standstill, measured by the car itself.'
		},
		'most-grip': {
			label: 'Most grip used',
			blurb: 'The hardest cornering of the trip, sideways force through the tyres.'
		},
		'monthly-distance': {
			label: 'Furthest in a month',
			blurb: 'Every kilometre driven in the month, added up.'
		}
	},
	groups: {
		Driving: 'Driving',
		Efficiency: 'Efficiency',
		Charging: 'Charging',
		Handling: 'Handling'
	} as Record<string, string>,
	medals: { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }
};

/** Claiming a place, holding one, and the badges that follow. */
export const claims = {
	youAre: (rank: number, board: string) => `You are #${rank} for ${board}`,
	thatBoard: 'that board',
	takeDownLater: 'Take it down again whenever you like, from your account.',
	takeDownLaterMonth: (month: string) => `${month}. You can take it down again whenever you like.`,
	claimFailed: 'That place could not be claimed',
	nameFailed: 'That name could not be saved.',
	onTheBoard: 'On the board:',
	forIn: (board: string, month: string) => `for ${board} in ${month}`,
	seeIt: 'See it',
	wouldBe: 'This would be',
	forBoard: 'for',
	inMonth: (month: string) => `in ${month}`,
	nameHint: 'Boards show a name rather than your e-mail. Choose one and this place is yours.',
	pickName: 'Pick a name',
	claim: 'Claim it',
	noThanks: 'No thanks',
	notPublished: (date: string) => `Nothing is published until you say so · open until ${date}`,
	// BoardPlaces
	yearSuffix: (year: string) => `${year} · the year`,
	nameSaved: 'That is the name your places will show',
	takenDown: 'Taken down',
	takenDownDetail: 'It leaves the board for everyone within a few minutes.',
	saveFailed: 'That could not be saved',
	title: 'Leaderboard',
	description:
		'Nothing of yours appears on a board unless you put it there. When something of yours would rank, it is listed here first.',
	nameLabel: 'The name your places appear under',
	change: 'Change',
	choose: 'Choose',
	nameRules:
		"Letters, digits, hyphens and underscores. A board shows this name, your car's model and the figures, never your e-mail address. You can change it once a day.",
	notify: 'Tell me when something of mine would rank',
	notifyHint:
		'In the app, and by e-mail if you have not been back in a couple of days. Also covers the summary of the year.',
	waiting: 'Waiting on you',
	openUntil: (date: string) => `open until ${date}`,
	onBoards: 'On the boards',
	closed: 'closed',
	seeBoard: 'See the board',
	takeDown: 'Take down',
	badges: 'Badges',
	medal: (name: string) => `${name} medal`,
	getBadge: 'Get badge',
	nothingYet:
		'Nothing yet. Keep an export in your account and anything of yours worth a place will turn up here.',
	seeMonth: "See this month's boards",
	// BadgeDialog
	badgePublic:
		'This picture is public: anyone with its address can load it. Taking the place down, or changing your name, takes it away.',
	imageLink: 'Image link',
	snippetCopied: (label: string) => `${label} copied`,
	copyFailed: 'Could not copy',
	copyByHand: 'Select the text and copy it by hand.',
	copySnippet: (label: string) => `Copy the ${label} snippet`
};

export const leaderboard = {
	year: (year: string) => `The year ${year}`,
	behind: (gap: string, rank: number) => `${gap} behind #${rank}`,
	listedAt: (rank: number) => `Listed at #${rank}`,
	listFailed: 'Could not list it',
	trips: (count: string, n: number) => `${count} ${n === 1 ? 'trip' : 'trips'}`,
	longest: (km: string) => `longest ${km} km`,
	seoTitle: (heading: string) => `Leaderboard · ${heading}`,
	seoDescription: (when: string) =>
		`What XPeng drivers have put their name to in ${when}: the fastest charge, the longest drive, the most efficient run.`,
	seoImageAlt: (heading: string) =>
		`The names and figures leading the LogbooX boards for ${heading}.`,
	youUnlisted: 'You · not listed yet',
	putName: 'Put my name on it',
	pickName: 'Pick a name first',
	title: 'Leaderboard',
	openUntil: (date: string) => `Open until ${date}`,
	open: 'Open',
	final: 'Final',
	period: 'Period',
	nothingLater: 'Nothing later yet',
	month: 'Month',
	yearTab: 'Year',
	emptyTitle: 'Nothing here yet',
	emptyDetail: (when: string) =>
		`No one has put a place up for ${when}. If you have an export of your own, yours may well be the first.`,
	readOwn: 'Read your own export',
	boards: 'Boards',
	nobodyYet: 'Nobody yet',
	listed: (n: number) => `${n === 1 ? 'driver' : 'drivers'} listed`,
	nobodyOnBoard: (when: string) => `Nobody has put a place on this board for ${when} yet.`,
	topThree: 'Top three',
	you: 'you',
	openIt: 'Open it',
	further: 'Further places',
	openEntry: (name: string, board: string) => `Open ${name}'s ${board.toLowerCase()}`,
	yourBadges: 'Your badges',
	yourPlaces: 'Your places',
	as: (name: string) => `as ${name}`,
	copyEmbed: 'Copy embed code',
	downloadPng: 'Download PNG',
	badgesAndPlaces: 'Badges and places',
	podiums: 'Most podium places',
	acrossBoards: (year: string) => `Across every board in ${year}`,
	driver: 'Driver',
	wins: 'Wins',
	topThreeColumn: 'Top three',
	how: 'How a place gets here',
	howDetail:
		"Every figure came out of one driver's own export, worked out in their browser, and appears because they chose to put their name to it. Sign in, keep an export in your account, and LogbooX will tell you when something of yours would rank. Nothing is published until you say so, and you can take it back down at any time."
};
