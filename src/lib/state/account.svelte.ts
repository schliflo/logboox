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
import { boardById } from '../leaderboard/boards';

export interface AccountUser {
	email: string;
	createdAt: number;
	autoSync: boolean;
	reminderEnabled: boolean;
	reminderAfterDays: number;
	/** The name places on a board are published under; null until one is chosen. */
	username: string | null;
	boardNotify: boolean;
}

/** A place on a public board this account could take, and has not answered yet. */
export interface BoardCandidate {
	id: string;
	board: string;
	month: string;
	kind: 'trip' | 'charging';
	value: number;
	rank: number;
	locksAt: number;
	startTime: number;
	vin: string;
	detail: Record<string, number | boolean | null>;
	createdAt: number;
	seen: boolean;
}

/** A place this account holds. */
export interface BoardEntry {
	id: string;
	board: string;
	month: string;
	value: number;
	rank: number;
	shareId: string | null;
	claimedAt: number;
	startTime: number;
	vin: string;
	locked: boolean;
}

export interface LeaderboardState {
	pending: BoardCandidate[];
	entries: BoardEntry[];
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
	leaderboard?: LeaderboardState;
}

type Status = 'unknown' | 'anonymous' | 'signed-in';

class AccountStore {
	status = $state<Status>('unknown');
	user = $state<AccountUser | null>(null);
	storage = $state<StorageUsage | null>(null);
	leaderboard = $state<LeaderboardState>({ pending: [], entries: [] });
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
			this.leaderboard = me.leaderboard ?? { pending: [], entries: [] };
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
			this.leaderboard = { pending: [], entries: [] };
			this.linkSentTo = null;
			this.busy = false;
		}
	}

	/**
	 * A place is waiting on an answer for this exact trip or session.
	 *
	 * Month boards are left out on purpose. A month's total is filed under the
	 * first trip in it, which makes that trip no more the reason for the place
	 * than any of the others — offering it there would be telling somebody their
	 * drive to the shops on the 2nd had won something. Those offers are made on
	 * the account page, where the month is the subject.
	 */
	candidateFor(vin: string, startTime: number): BoardCandidate | null {
		return (
			this.leaderboard.pending.find(
				(candidate) =>
					candidate.vin === vin &&
					candidate.startTime === startTime &&
					boardById(candidate.board)?.scope !== 'month'
			) ?? null
		);
	}

	/** A place already taken for this exact trip or session. See above. */
	entryFor(vin: string, startTime: number): BoardEntry | null {
		return (
			this.leaderboard.entries.find(
				(entry) =>
					entry.vin === vin &&
					entry.startTime === startTime &&
					boardById(entry.board)?.scope !== 'month'
			) ?? null
		);
	}

	/**
	 * Chooses the name places are published under.
	 *
	 * Not optimistic, unlike the switches: this one is refused often enough —
	 * taken, reserved, changed too recently — that showing it as done and then
	 * taking it back would be the wrong way round.
	 */
	async setUsername(username: string): Promise<void> {
		const result = await api<{ username: string }>('/api/v1/leaderboard/username', {
			method: 'PUT',
			body: { username }
		});
		if (this.user) this.user = { ...this.user, username: result.username };
	}

	/** Tells the server these have been seen, so no mail goes out about them. */
	async markSeen(): Promise<void> {
		const ids = this.leaderboard.pending.filter((c) => !c.seen).map((c) => c.id);
		if (ids.length === 0) return;
		this.leaderboard = {
			...this.leaderboard,
			pending: this.leaderboard.pending.map((c) => ({ ...c, seen: true }))
		};
		try {
			await api('/api/v1/leaderboard/candidates/seen', { method: 'POST', body: { ids } });
		} catch {
			// Nothing on screen depends on this; at worst a nudge arrives later.
		}
	}

	async dismiss(id: string): Promise<void> {
		await api(`/api/v1/leaderboard/candidates/${encodeURIComponent(id)}/dismiss`, {
			method: 'POST'
		});
		this.leaderboard = {
			...this.leaderboard,
			pending: this.leaderboard.pending.filter((c) => c.id !== id)
		};
	}

	async claim(candidateId: string, shareId?: string | null): Promise<{ rank: number }> {
		const result = await api<{ entry: BoardEntry; rank: number }>('/api/v1/leaderboard/claims', {
			method: 'POST',
			body: { candidateId, shareId: shareId ?? undefined }
		});
		await this.refresh();
		return { rank: result.rank };
	}

	async removeEntry(id: string): Promise<void> {
		await api(`/api/v1/leaderboard/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
		this.leaderboard = {
			...this.leaderboard,
			entries: this.leaderboard.entries.filter((entry) => entry.id !== id)
		};
	}

	async updateSettings(
		patch: Partial<
			Pick<AccountUser, 'autoSync' | 'reminderEnabled' | 'reminderAfterDays' | 'boardNotify'>
		>
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
		this.leaderboard = { pending: [], entries: [] };
		this.status = 'anonymous';
	}
}

export const account = new AccountStore();
