export const tokens = {
	createFailed: 'The token could not be created.',
	revokeFailed: 'The token could not be revoked',
	stillWorks: 'It still works.',
	revoked: 'Token revoked',
	revokedDetail: (name: string) => `${name} stopped working immediately.`,
	copied: 'Copied',
	copyFailed: 'Could not copy',
	copyByHand: 'Select the token and copy it by hand.',
	title: 'API access',
	description:
		"Read your own trips, charging sessions and the car's last known state — from Home Assistant, a script, or anything else that can send a header.",
	made: (date: string) => `made ${date}`,
	lastUsed: (date: string) => `last used ${date}`,
	neverUsed: 'never used',
	revoke: (name: string) => `Revoke ${name}`,
	none: 'No tokens yet.',
	newToken: 'New token',
	readOnlyBefore:
		'A token reads; it cannot change anything, and it cannot make another token. The API is documented in',
	copyNow: 'Copy it now',
	onlyOnce: 'This is the only time it is shown. If it is lost, revoke it and make another.',
	copyToken: 'Copy the token',
	newTitle: 'New API token',
	newDetail: 'Name it after whatever will hold it, so a revoked one is the right one.',
	name: 'Name',
	namePlaceholder: 'Home Assistant',
	creating: 'Creating…',
	create: 'Create token'
};

export const library = {
	demonstration: 'Demonstration data',
	backupFailed: 'The backup could not be written',
	somethingWrong: 'Something went wrong.',
	nothingCopied: 'Nothing was copied to your account',
	notCopied: (count: number) =>
		count === 1 ? 'One export was not copied' : `${count} exports were not copied`,
	keptInAccount: (count: number) =>
		count === 1 ? 'Kept in your account' : `${count} exports kept in your account`,
	keptInAccountDetail: 'They will still be here if this browser forgets everything.',
	removeFailed: 'It could not be removed from your account',
	removed: 'Removed from your account',
	removedDetail: 'Links you made keep their own copy. The copy in this browser is untouched.',
	fetchUnfinished: 'The fetch did not finish',
	fetchFailed: (count: number) =>
		count === 1 ? 'That export could not be fetched' : 'Some exports could not be fetched',
	title: 'Imported files',
	intro: (signedIn: boolean) =>
		`What your record is made of${signedIn ? ', kept in this browser, in your account, or both' : ', stored on this device only'}. Nothing here needs looking after day to day.`,
	keepAll: (count: number) =>
		count === 1 ? 'Keep it in my account' : `Keep all ${count} in my account`,
	backUpAll: 'Back up everything',
	removeAll: 'Remove everything',
	demo: 'Demo',
	groupSpan: (span: string, count: number, memory: string) =>
		`${span} across ${count} exports, up to ${memory} of memory at once.`,
	heavy: 'That is a great deal for one tab to hold.',
	details: (count: number) => `The ${count} weeks and files behind it`,
	openTogether: 'Open as one record',
	both: 'Kept here and in your account',
	inAccount: 'In your account',
	onlyHere: 'Only in this browser',
	entry: (days: number, km: string, trips: number, size: string) =>
		`${days} days · ${km} km · ${trips} trips · ${size}`,
	more: 'More for this export',
	openAlone: 'Open on its own',
	fetchOpen: 'Fetch and open',
	backUp: 'Back up',
	keepInAccount: 'Keep in my account',
	fetchHere: 'Fetch to this browser',
	removeAccount: 'Remove from my account',
	removeHere: 'Remove from this browser',
	usage: (count: number, size: string) =>
		`${count} ${count === 1 ? 'export' : 'exports'} taking ${size}`,
	quota: (size: string) => `of roughly ${size} this site may use.`,
	onDevice: 'on this device.',
	evictionWarning: (signedIn: boolean) =>
		`A browser can clear its own storage — Safari does so after a week away — so keep a backup of anything you want to hold on to${signedIn ? ', or a copy in your account' : ''}.`,
	nothingHere:
		'Nothing is stored in this browser. Fetch an export to read it, and it is kept here as well.',
	confirmTitle: 'Remove every kept export?',
	confirmDetail: (count: number, size: string) =>
		`All ${count} of them, ${size}, deleted from this browser. The original files XPeng sent you are untouched, but anything not backed up would have to be dropped in again.`,
	keepThem: 'Keep them'
};

export const xpeng = {
	title: 'Automatic import from XPeng',
	description:
		'Every day LogbooX fetches your export from XPeng and adds what is new to this account, as one continuous record. No month is missed, and nothing needs doing.',
	connected: (date: string) => `Connected ${date}`,
	lastFetched: (date: string) => `last fetched ${date}`,
	nextFetch: (date: string) => `next fetch ${date}`,
	exporting: 'XPeng is generating an export right now.',
	importedTo: (date: string) => `Your record in this account reaches ${date}.`,
	messages: {
		downloadFailed: 'The last download from XPeng failed. Trying again within the hour.',
		notImported: 'Earlier exports could not be imported yet, so nothing more is fetched for now.',
		exportFailed: 'XPeng could not generate the export. Trying again tomorrow.',
		limit: 'XPeng’s limit of five exports a day is used up. Trying again tomorrow.',
		unauthorized:
			'XPeng has no authorisation for these credentials. Check them, or authorise LogbooX again in the XPeng Data Center.',
		tokenExpired:
			'XPeng no longer accepts this access token. Authorise LogbooX again in the XPeng Data Center and enter the new credentials.',
		appError:
			'XPeng refused LogbooX’s own credentials. This is ours to fix; nothing is needed from you.',
		error: 'XPeng answered with an unexpected error. Trying again within the hour.',
		importFailed: 'The last export could not be imported. This is ours to fix; it is retried.',
		quota: 'This account is full, so the last export could not be added.'
	},
	connect: 'Connect',
	replace: 'Enter new credentials',
	disconnect: 'Disconnect',
	disconnected: 'Disconnected',
	disconnectedDetail: 'Nothing more is fetched. What was imported stays in the account.',
	formTitle: 'Your XPeng credentials',
	formDetail:
		'Authorise LogbooX in the XPeng Data Center first. XPeng then mails you these four values; copy them exactly.',
	enterpriseName: 'Enterprise name, exactly as typed in the Data Center',
	save: 'Save',
	saving: 'Saving…',
	saveFailed: 'The credentials could not be saved.',
	saved: 'Saved',
	savedDetail: 'The first fetch starts within the hour; the last thirty days arrive soon after.',
	guideBefore: 'Step by step, with what to type where:',
	pulled: 'New days from XPeng',
	pulledDetail: 'Added to your record in this browser.',
	open: 'Open',
	update: 'Update now',
	updating: 'Asking XPeng…',
	updateExporting:
		'XPeng is preparing the file, which takes a few minutes. You can leave this page.',
	updateDone: 'Up to date',
	updateDoneDetail: 'The latest data from XPeng is in your record.',
	updateWait: (time: string) => `Next update possible from ${time}.`,
	updateLater: 'XPeng is still at it. The next hourly run picks it up.',
	updateFailed: 'Could not update'
};
