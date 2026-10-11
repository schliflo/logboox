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
	linkCopied: 'Link copied',
	linkCopiedDetail: 'Anyone with it can read this export. Revoke it from your account.',
	linkFailed: 'The link could not be made',
	removeFailed: 'It could not be removed from your account',
	removed: 'Removed from your account',
	removedDetail: 'Links to the whole export are revoked. The copy in this browser is untouched.',
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
	shareExport: 'Share this export',
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
