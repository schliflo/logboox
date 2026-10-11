/** The sign-in control and its dialog. */
export const accountMenu = {
	benefits: [
		'Keep your exports for good, not just until this browser forgets them',
		'A reminder when the next export is due, before the window rolls past',
		'Read your own data over an API, for Home Assistant and anything else',
		'Share a single trip or charging session with a link'
	],
	signedOut: 'Signed out',
	signedOutDetail: 'Everything kept in this browser is still here.',
	placesWaiting: (count: number) => `${count} place${count === 1 ? '' : 's'} waiting on you`,
	account: 'Account',
	leaderboard: 'Leaderboard',
	signOut: 'Sign out',
	signIn: 'Sign in',
	checkInbox: 'Check your inbox',
	linkSent: (email: string) =>
		`If ${email} can have an account, a sign-in link is on its way. It works once and expires in fifteen minutes.`,
	differentAddress: 'Use a different address',
	title: 'Sign in to LogbooX',
	noPassword: 'There is no password. Enter your address and we will send a link.',
	email: 'E-mail address',
	emailPlaceholder: 'you@example.com',
	sending: 'Sending…',
	sendLink: 'Send me a link',
	smallPrintBefore:
		'An account changes nothing about how your export is read: it is still parsed in this tab. Nothing is copied to it unless you ask for that, or switch automatic copying on. Signing in means accepting the',
	smallPrintTerms: 'terms',
	smallPrintMiddle: '; the',
	smallPrintPrivacy: 'privacy notice',
	smallPrintAfter: 'says what an account stores.'
};
