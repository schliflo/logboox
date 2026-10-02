/**
 * The public variables this deployment is told about.
 *
 * None of them is fixed at build time: the same bundle serves logboox.app and
 * the legacy Worker, and each says what it is through its own `vars`. The
 * prerender reads `.env.production` for the same names, and the two must
 * agree, or hydration quietly undoes what the prerender wrote.
 */

import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_SITE_URL: {
		public: true,
		description: 'The public origin, for absolute URLs in meta tags and mail. Empty when unknown.',
		schema: (value) => value ?? ''
	},
	PUBLIC_ACCOUNTS: {
		public: true,
		description: 'Whether this deployment has an account database behind it.',
		schema: (value) => value === '1'
	},
	PUBLIC_MOVED_TO: {
		public: true,
		description: 'Where the app now lives, set only on a superseded deployment.',
		schema: (value) => value ?? ''
	}
});
