// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Scope } from '$lib/server/auth/apiTokens';
import type { User } from '$lib/server/auth/users';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			/**
			 * Who is asking, and how. `session` is a browser with a cookie;
			 * `token` is something the user pointed at their own data, and may
			 * never manage tokens or sessions.
			 */
			auth: {
				user: User;
				via: 'session' | 'token';
				scopes: Scope[];
			} | null;
			/** True for the daily reminder run, which is not a user at all. */
			cron: boolean;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
