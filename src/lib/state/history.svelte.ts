/**
 * The library: every export this reader can open, wherever it is kept.
 *
 * Two places, deliberately not merged into one. This browser's own storage is
 * the fast one and the private one, and it is where an export has to be for
 * anything to read it. An account is the durable one — it survives a cleared
 * browser, a new laptop, Safari's week-long patience — but nothing is opened
 * from it directly; it is fetched down first.
 *
 * So an export is in one place, the other, or both, and the library says
 * which. Only the summaries live here either way: the telemetry stays
 * compressed until something asks for it, so listing a year of exports costs
 * no more than listing one.
 */

import { browser } from '$app/environment';
import { ApiError, api } from '../api/client';
import { fetchFromAccount, syncToAccount, type LoadProgress } from '../data/client';
import { backupKept } from '../data/client';
import { estimateOpen, type ExportRecord } from '../history/codec';
import { clearExports, deleteExports, listExports, storageAvailable } from '../history/db';
import { downloadBlob } from '../utils/download';
import { account } from './account.svelte';
import { settings } from './settings.svelte';

/** One export as the account describes it, without any of its buffers. */
export interface RemoteExport {
	id: string;
	vin: string;
	vmodel: string;
	startTime: number;
	endTime: number;
	rows: number;
	days: number;
	distanceKm: number;
	trips: number;
	storedBytes: number;
	isDemo: boolean;
	uploadedAt: number;
}

/** What the library shows for one export, and where it can be found. */
export interface LibraryEntry {
	id: string;
	vin: string;
	vmodel: string;
	startTime: number;
	endTime: number;
	days: number;
	distanceKm: number;
	trips: number;
	storedBytes: number;
	isDemo: boolean;
	/** Kept in this browser, and therefore openable. */
	local: boolean;
	/** Kept in the account, and therefore outliving this browser. */
	remote: boolean;
}

export interface VehicleGroup {
	vin: string;
	vmodel: string;
	isDemo: boolean;
	entries: LibraryEntry[];
}

type Status = 'unknown' | 'ready' | 'unavailable';

/** Asked at most once a session, and only after something was actually kept. */
let persistenceRequested = false;

function entryFromRecord(record: ExportRecord, remote: boolean): LibraryEntry {
	return {
		id: record.id,
		vin: record.vin,
		vmodel: record.vmodel,
		startTime: record.startTime,
		endTime: record.endTime,
		days: record.days,
		distanceKm: record.distanceKm,
		trips: record.trips,
		storedBytes: record.storedBytes,
		isDemo: record.isDemo,
		local: true,
		remote
	};
}

function entryFromRemote(remote: RemoteExport): LibraryEntry {
	return { ...remote, local: false, remote: true };
}

class HistoryStore {
	status = $state<Status>('unknown');
	entries = $state<ExportRecord[]>([]);
	remote = $state<RemoteExport[]>([]);
	usage = $state<{ used: number; quota: number } | null>(null);
	busy = $state(false);
	error = $state<string | null>(null);
	/** Set while an export is on its way to or from the account. */
	transfer = $state<LoadProgress | null>(null);

	/** Everything openable or fetchable, by vehicle, newest first. */
	get groups(): VehicleGroup[] {
		const remoteIds = new Set(this.remote.map((entry) => entry.id));
		const localIds = new Set(this.entries.map((entry) => entry.id));

		const all: LibraryEntry[] = [
			...this.entries.map((record) => entryFromRecord(record, remoteIds.has(record.id))),
			...this.remote.filter((entry) => !localIds.has(entry.id)).map(entryFromRemote)
		];

		const byVin = new Map<string, VehicleGroup>();
		for (const entry of all) {
			let group = byVin.get(entry.vin);
			if (!group) {
				group = { vin: entry.vin, vmodel: entry.vmodel, isDemo: entry.isDemo, entries: [] };
				byVin.set(entry.vin, group);
			}
			group.entries.push(entry);
			// A vehicle counts as a demonstration only if nothing real was kept
			// under the same identity.
			group.isDemo = group.isDemo && entry.isDemo;
		}

		const groups = [...byVin.values()];
		for (const group of groups) group.entries.sort((a, b) => b.startTime - a.startTime);
		return groups.sort((a, b) => b.entries[0].startTime - a.entries[0].startTime);
	}

	get count(): number {
		return this.groups.reduce((sum, group) => sum + group.entries.length, 0);
	}

	get totalBytes(): number {
		return this.entries.reduce((sum, entry) => sum + entry.storedBytes, 0);
	}

	/** Exports the account holds that this browser does not. */
	get missingLocally(): LibraryEntry[] {
		const local = new Set(this.entries.map((entry) => entry.id));
		return this.remote.filter((entry) => !local.has(entry.id)).map(entryFromRemote);
	}

	/** Exports kept here that the account does not have a copy of. */
	get notInAccount(): ExportRecord[] {
		if (!account.signedIn) return [];
		const remote = new Set(this.remote.map((entry) => entry.id));
		return this.entries.filter((entry) => !remote.has(entry.id) && !entry.isDemo);
	}

	async refresh(): Promise<void> {
		if (!browser || !storageAvailable()) {
			this.status = 'unavailable';
			await this.refreshRemote();
			return;
		}
		try {
			this.entries = await listExports();
			this.status = 'ready';
			this.error = null;
			await this.measure();
		} catch (error) {
			this.status = 'unavailable';
			this.error = error instanceof Error ? error.message : 'The local store could not be read.';
		}
		await this.refreshRemote();
	}

	/** The account's listing. Silent when nobody is signed in, which is most of the time. */
	async refreshRemote(): Promise<void> {
		if (!browser || !account.enabled || !account.signedIn) {
			this.remote = [];
			return;
		}
		try {
			const body = await api<{ exports: RemoteExport[] }>('/api/v1/exports');
			this.remote = body.exports;
		} catch (error) {
			this.remote = [];
			if (error instanceof ApiError && !error.unauthorized) {
				this.error = error.message;
			}
		}
	}

	private async measure(): Promise<void> {
		if (!navigator.storage?.estimate) return;
		try {
			const estimate = await navigator.storage.estimate();
			this.usage = { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
		} catch {
			this.usage = null;
		}
	}

	/**
	 * Asks the browser to treat this data as worth keeping. It only ever helps:
	 * a refusal changes nothing, and on Safari even a yes does not survive a
	 * week of not visiting — which is what backups and accounts are for.
	 */
	async requestPersistence(): Promise<void> {
		if (persistenceRequested || !browser || !navigator.storage?.persist) return;
		persistenceRequested = true;
		try {
			await navigator.storage.persist();
		} catch {
			// Nothing to do: storage stays best-effort.
		}
	}

	async remove(ids: string[]): Promise<void> {
		this.busy = true;
		try {
			await deleteExports(ids);
			await this.refresh();
		} finally {
			this.busy = false;
		}
	}

	async removeAll(): Promise<void> {
		this.busy = true;
		try {
			await clearExports();
			await this.refresh();
		} finally {
			this.busy = false;
		}
	}

	/** Writes the chosen exports out as one archive and hands it to the user. */
	async backup(ids: string[]): Promise<void> {
		this.busy = true;
		try {
			const result = await backupKept(ids);
			downloadBlob(result.name, result.blob);
		} finally {
			this.busy = false;
		}
	}

	/**
	 * Copies exports up to the account. Reports what would not go rather than
	 * throwing on the first failure: three exports where one is too large
	 * should still put the other two where they were asked to go.
	 */
	async sync(
		ids: string[]
	): Promise<{ ids: string[]; failed: Array<{ id: string; reason: string }> }> {
		if (ids.length === 0) return { ids: [], failed: [] };
		this.busy = true;
		try {
			const result = await syncToAccount(ids, settings.timeZone, (progress) => {
				this.transfer = progress;
			});
			await this.refreshRemote();
			await account.refresh();
			return { ids: result.ids, failed: result.failed };
		} finally {
			this.transfer = null;
			this.busy = false;
		}
	}

	/** Brings exports down from the account into this browser. */
	async pull(
		ids: string[]
	): Promise<{ ids: string[]; failed: Array<{ id: string; reason: string }> }> {
		if (ids.length === 0) return { ids: [], failed: [] };
		this.busy = true;
		try {
			const result = await fetchFromAccount(ids, (progress) => {
				this.transfer = progress;
			});
			await this.refresh();
			return { ids: result.ids, failed: result.failed };
		} finally {
			this.transfer = null;
			this.busy = false;
		}
	}

	/** Removes the account's copy, leaving this browser's alone. */
	async forget(ids: string[]): Promise<void> {
		this.busy = true;
		try {
			for (const id of ids) {
				await api(`/api/v1/exports/${encodeURIComponent(id)}`, { method: 'DELETE' });
			}
			await this.refreshRemote();
			await account.refresh();
		} finally {
			this.busy = false;
		}
	}

	/**
	 * What opening a selection would cost. Only exports kept here can be
	 * measured, since the estimate is worked out from their column list.
	 */
	estimate(ids: string[]): { rows: number; bytes: number } {
		const wanted = new Set(ids);
		return estimateOpen(this.entries.filter((entry) => wanted.has(entry.id)));
	}

	/** True when every chosen export is here and can be opened without a download. */
	openable(ids: string[]): boolean {
		const local = new Set(this.entries.map((entry) => entry.id));
		return ids.length > 0 && ids.every((id) => local.has(id));
	}
}

export const history = new HistoryStore();
