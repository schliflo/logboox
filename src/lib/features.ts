/**
 * What this deployment offers.
 *
 * Accounts need a database, and only logboox.app has one. The legacy Worker
 * runs the same bundle with no bindings, so the sign-in UI has to be able to
 * switch itself off — otherwise it would offer something that answers 503.
 *
 * Read the same way as the SEO variables, and with the same rule: the value
 * must be set in `.env.production` for the prerender and in `wrangler.jsonc`
 * for the client, and the two must agree.
 */

import { env } from '$env/dynamic/public';

export const ACCOUNTS_ENABLED = env.PUBLIC_ACCOUNTS === '1';
