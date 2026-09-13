/**
 * The signed-in account, if there is one.
 *
 * Signing in is optional and adds to the app rather than gating it: without an
 * account everything still works, exports are kept in this browser, and the
 * only difference is that nothing outlives the device. So this store starts
 * `unknown`, asks the server once, and settles on `anonymous` for the great
 * majority of readers without anything on screen having waited for it.
 */

import { browser } from '$app/environment';
import { ApiError, api } from '../api/client';
import { ACCOUNTS_ENABLED } from '../features';

export interface AccountUser {
	email: string;
	createdAt: number;
	autoSync: boolean;
	reminderEnabled: boolean;
	reminderAfterDays: number;
}

export interface StorageUsage {
	exports: number;
	usedBytes: number;
	quotaBytes: number;
}

interface MeResponse {
	user: AccountUser;
	via: 'session' | 'token';
	storage: StorageUsage;
}

type Status = 'unknown' | 'anonymous' | 'signed-in';

class AccountStore {
	status = $state<Status>('unknown');
	user = $state<AccountUser | null>(null);
	storage = $state<StorageUsage | null>(null);
	busy = $state(false);
	error = $state<string | null>(null);
	/** Set once a link has been asked for, so the form can say so. */
	linkSentTo = $state<string | null>(null);

	/** Whether this deployment has a server to talk to at all. */
	readonly enabled = ACCOUNTS_ENABLED;

	get signedIn(): boolean {
		return this.status === 'signed-in' && this.user !== null;
	}

	async refresh(): Promise<void> {
		if (!browser || !this.enabled) {
			this.status = 'anonymous';
			return;
		}
		try {
			const me = await api<MeResponse>('/api/v1/me');
			this.user = me.user;
			this.storage = me.storage;
			this.status = 'signed-in';
		} catch (error) {
			this.user = null;
			this.storage = null;
			this.status = 'anonymous';
			// A 401 is the ordinary case — nobody is signed in. Anything else is
			// worth keeping so the account page can say what went wrong.
			if (error instanceof ApiError && !error.unauthorized && error.status !== 503) {
				this.error = error.message;
			}
		}
	}

	/** Asks for a sign-in link. The answer never says whether the address is known. */
	async requestLink(email: string): Promise<void> {
		this.busy = true;
		this.error = null;
		try {
			await api('/api/v1/auth/request', { method: 'POST', body: { email } });
			this.linkSentTo = email.trim();
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'The link could not be requested.';
			throw error;
		} finally {
			this.busy = false;
		}
	}

	/** Spends the link from the e-mail and takes on the session it opens. */
	async verify(token: string): Promise<{ created: boolean }> {
		const result = await api<{ created: boolean }>('/api/v1/auth/verify', {
			method: 'POST',
			body: { token }
		});
		await this.refresh();
		return result;
	}

	async signOut(): Promise<void> {
		this.busy = true;
		try {
			await api('/api/v1/auth/logout', { method: 'POST' });
		} catch {
			// Even a failed call should leave the app looking signed out; the
			// cookie is gone either way on the next load.
		} finally {
			this.user = null;
			this.storage = null;
			this.status = 'anonymous';
			this.linkSentTo = null;
			this.busy = false;
		}
	}

	async updateSettings(
		patch: Partial<Pick<AccountUser, 'autoSync' | 'reminderEnabled' | 'reminderAfterDays'>>
	) {
		if (!this.user) return;
		const previous = { ...this.user };
		this.user = { ...this.user, ...patch };
		try {
			await api('/api/v1/me', { method: 'PATCH', body: patch });
		} catch (error) {
			this.user = previous;
			this.error = error instanceof Error ? error.message : 'That could not be saved.';
			throw error;
		}
	}

	async deleteAccount(): Promise<void> {
		await api('/api/v1/me', { method: 'DELETE' });
		this.user = null;
		this.storage = null;
		this.status = 'anonymous';
	}
}

export const account = new AccountStore();
