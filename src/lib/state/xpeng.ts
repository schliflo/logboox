/**
 * Automatic import, the browser's half: the account card's status, "Update
 * now", and bringing down what the import Worker added to the timeline, so the
 * record here grows without anyone asking. See docs/auto-import.md.
 */

import { toast } from 'svelte-sonner';
import { api } from '../api/client';
import { m } from '../i18n/index.svelte';
import { account } from './account.svelte';
import { data } from './dataset.svelte';
import { history } from './history.svelte';
import type { UpdateResult } from '../server/xpeng/update';

export type { UpdateResult };

export interface XpengStatus {
	/** False when this deployment does not run automatic import. */
	available: boolean;
	/** Whether "Update now" can reach the import Worker from here. */
	updatable: boolean;
	enterpriseName: string;
	link: {
		state: 'waiting' | 'exporting' | 'reauth';
		enterpriseName: string;
		createdAt: number;
		nextAt: number | null;
		fetchedAt: number | null;
		importedTo: number | null;
		message: keyof (typeof m)['xpeng']['messages'] | null;
		/** When "Update now" may ask XPeng for a new export (epoch seconds); null while one is being built. */
		updateAfter: number | null;
	} | null;
}

/** Quiet unless something arrived; a failure waits for the next start. */
export async function pullAutomatic(): Promise<void> {
	if (!account.signedIn || data.status === 'loading') return;
	try {
		await history.refresh();
		if ((await history.adoptTimeline()) > 0) {
			toast(m.xpeng.pulled, {
				description: m.xpeng.pulledDetail,
				action: { label: m.xpeng.open, onClick: () => data.openRecord() }
			});
		}
	} catch {
		// Offline, or storage unavailable: the next start tries again.
	}
}

/** How often the app asks again while XPeng builds the file. */
const POLL_MS = 15_000;

/** XPeng usually needs a few minutes; past this, the hourly run finishes it. */
const GIVE_UP_MS = 15 * 60_000;

/**
 * Asks for today's export and keeps asking while XPeng builds it. Resolves
 * with the last answer; `imported` means the timeline here is up to date too.
 */
export async function updateNow(
	onProgress?: (result: UpdateResult) => void
): Promise<UpdateResult> {
	const started = Date.now();
	for (;;) {
		const result = await api<UpdateResult>('/api/v1/xpeng/update', { method: 'POST' });
		onProgress?.(result);
		const again = result.kind === 'exporting' || result.kind === 'busy';
		if (!again || Date.now() - started > GIVE_UP_MS) {
			if (result.kind === 'imported') await pullAutomatic();
			return result;
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}
