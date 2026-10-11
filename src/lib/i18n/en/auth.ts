export const verify = {
	title: 'Sign in',
	welcome: 'Welcome to LogbooX',
	signedIn: 'Signed in',
	createdDetail: 'Your account is ready. Nothing has been uploaded to it yet.',
	returningDetail: 'Everything you kept in this browser is still here.',
	unusable: 'That link could not be used.',
	heading: 'Sign in to LogbooX',
	noAccounts: 'This address does not host accounts.',
	oneClick: 'One click to finish. The link works once.',
	noToken: 'This link is missing its token.',
	signInAt: 'Sign in at',
	instead: 'instead.',
	backToStart: 'Back to the start',
	signingIn: 'Signing in…',
	signIn: 'Sign in',
	waits:
		'Nothing happens until you press that. Links in e-mail are often opened by software before a person sees them, which is why this one waits.'
};

export const unsubscribe = {
	title: 'Stop e-mails',
	failed: 'That did not work.',
	boardOff: 'Leaderboard messages are off',
	remindersOff: 'Reminders are off',
	stopBoard: 'Stop messages about places on a board?',
	stopReminders: 'Stop reminders about new exports?',
	boardDone: (email: string) =>
		`${email} will no longer get messages about places on a board, or the summary of the year, unless you turn them back on in your account.`,
	remindersDone: (email: string) =>
		`${email} will no longer get reminders about new exports, unless you turn them back on in your account.`,
	boardExplain:
		'Your places stay exactly as they are. This only stops the messages telling you when something of yours would rank, and the summary of the year.',
	remindersExplain:
		'You will still be able to import exports whenever you like. This only stops the messages.',
	calendar:
		'XPeng only keeps a rolling thirty days, so without a reminder it is worth putting a note in your own calendar.',
	backToAccount: 'Back to your account',
	openAccount: 'Open your account',
	turningOff: 'Turning them off…',
	stopThese: 'Stop these messages',
	stopTheReminders: 'Stop the reminders',
	noToken: 'This link is missing its token.'
};

export const accountPage = {
	title: 'Account',
	saveFailed: 'That could not be saved',
	deleted: 'Account deleted',
	deletedDetail:
		'Everything kept in the account is gone. What is stored in this browser is untouched.',
	deleteFailed: 'The account could not be deleted',
	backToStart: 'Back to the start',
	elsewhere: 'Accounts live at logboox.app',
	elsewhereDetail: 'This address serves an older deployment with no account database.',
	yours: 'Your account',
	signedInAs: (email: string, date: string) => `Signed in as ${email} since ${date}.`,
	exportsKept: (count: number) => `${count} ${count === 1 ? 'export kept' : 'exports kept'}`,
	usedOf: (used: string, quota: string) => `${used} of ${quota}`,
	nothingYet: (quota: string) => `nothing yet, of ${quota}`,
	nearlyFull: (share: string) => `${share} used. Remove an export you no longer need to make room.`,
	signOut: 'Sign out',
	keeping: 'Keeping exports',
	keepingDetail:
		'A copy in the account outlives this browser. Exports are still read here, and still kept here. Nothing is copied unless you ask for it or switch this on.',
	autoSync: 'Copy new imports to my account automatically',
	reminders: 'Reminders',
	remindersDetail:
		'XPeng only ever holds a rolling thirty days. A month nobody asked for cannot be recovered later.',
	reminderSwitch: 'E-mail me when a new export is due',
	reminderDays: 'Remind me after this many days',
	reminderHint: 'Counted from where your newest export stops, not from when you imported it.',
	deleteTitle: 'Delete this account',
	deleteDetail:
		'Removes the account, every export kept in it and every shared link, with the files behind them. What is stored in this browser stays where it is.',
	deleteButton: 'Delete account',
	deleteConfirmTitle: (email: string) => `Delete ${email}?`,
	deleteConfirmDetail:
		'This cannot be undone. Back up anything you want to keep first — the copies in this browser are not affected.',
	typeBefore: 'Type',
	typeAfter: 'to confirm',
	confirmWord: 'delete',
	keepIt: 'Keep it',
	deleteEverything: 'Delete everything',
	notSignedIn: 'Not signed in',
	takingBack: 'Taking you back to the start.'
};
