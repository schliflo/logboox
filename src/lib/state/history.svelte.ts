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

import { browser } from '$app/env';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { ApiError, api } from '../api/client';
import {
	fetchFromAccount,
	syncToAccount,
	type LoadProgress,
	type TransferResult
} from '../data/client';
import { backupKept } from '../data/client';
import { blockSlot, estimateOpen, type ExportRecord } from '../history/codec';
import { clearExports, deleteExports, listExports, storageAvailable } from '../history/db';
import { downloadBlob } from '../utils/download';
import { boardById } from '../leaderboard/boards';
import { m } from '../i18n/index.svelte';
import { boardText } from '../i18n/boards';
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

/**
 * Says that something in what was just uploaded would stand on a public board.
 *
 * Once, however many boards it is, and with somewhere to go rather than an
 * instruction — nothing has been published, and the whole point is that the
 * next move is theirs. It waits to be dismissed for the same reason: an
 * upload finishes while somebody is reading their own month, and a notice
 * that vanishes on its own is one they never saw.
 */
function announceCandidates(candidates: TransferResult['candidates']): void {
	if (candidates.length === 0) return;

	const first = candidates[0];
	const board = boardById(first.board);
	const title =
		candidates.length === 1
			? m.notices.candidateOne(board ? boardText(board.id).label : null, first.rank)
			: m.notices.candidateMany(candidates.length);

	toast(title, {
		description: m.notices.candidateDetail,
		duration: Number.POSITIVE_INFINITY,
		closeButton: true,
		action: { label: m.notices.see, onClick: () => goto('/account#leaderboard') }
	});
}

class HistoryStore {
	status = $state<Status>('unknown');
	entries = $state<ExportRecord[]>([]);
	remote = $state<RemoteExport[]>([]);
	/** Uploads the account merged into its timeline and removed. */
	folded = $state<string[]>([]);
	usage = $state<{ used: number; quota: number } | null>(null);
	busy = $state(false);
	error = $state<string | null>(null);
	/** Set while an export is on its way to or from the account. */
	transfer = $state<LoadProgress | null>(null);

	constructor() {
		// What the account listed is the account's: once nobody is signed in it
		// must not stay on screen, offering to fetch exports of someone's who left.
		account.onSignedOut(() => {
			this.remote = [];
			this.folded = [];
		});
	}

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
		// A block not in the account is one it has since replaced; it is never sent back.
		return this.entries.filter(
			(entry) => !remote.has(entry.id) && !entry.isDemo && !blockSlot(entry.id)
		);
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
			this.error = error instanceof Error ? error.message : m.errors.localStore;
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
			const body = await api<{ exports: RemoteExport[]; folded?: string[] }>('/api/v1/exports');
			this.remote = body.exports;
			this.folded = body.folded ?? [];
		} catch (error) {
			// Offline says nothing about what the account holds, so the last
			// listing stays; anything else means it can no longer be trusted.
			if (error instanceof ApiError && error.status === 0) return;
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
			announceCandidates(result.candidates);
			// What was sent is now part of the timeline: swap it for its weeks.
			await this.adoptTimeline().catch(() => {});
			return { ids: result.ids, failed: result.failed };
		} finally {
			this.transfer = null;
			this.busy = false;
		}
	}

	/**
	 * Brings this browser's copy of the account's timeline up to date: new
	 * weekly blocks in; replaced blocks, and uploads merged into blocks, out.
	 * Each week is pulled once, so one removed from this browser stays
	 * removed. Returns how many blocks arrived.
	 */
	async adoptTimeline(): Promise<number> {
		if (this.adopting || !account.signedIn) return 0;
		this.adopting = true;
		try {
			const held = rememberedSlots();
			for (const entry of this.entries) {
				const slot = blockSlot(entry.id);
				if (slot) held.add(slot);
			}
			const local = new Set(this.entries.map((entry) => entry.id));
			const localSlots = new Set(this.entries.map((entry) => blockSlot(entry.id)));
			const foldedHere = this.entries.filter(
				(entry) => !blockSlot(entry.id) && this.folded.includes(entry.id)
			);
			// Per car, the week after which a block counts as new: the newest held, or
			// on a browser that holds none, the last RECENT_WEEKS. Older weeks open on demand.
			const since = new Map<string, number>();
			for (const slot of held) {
				const { car, week } = slotParts(slot);
				since.set(car, Math.max(since.get(car) ?? -Infinity, week));
			}
			const heldCars = new Set(since.keys());
			for (const entry of this.remote) {
				const slot = blockSlot(entry.id);
				if (!slot) continue;
				const { car, week } = slotParts(slot);
				if (heldCars.has(car)) continue;
				since.set(car, Math.max(since.get(car) ?? -Infinity, week - RECENT_WEEKS * WEEK));
			}
			const wanted = this.remote.filter((entry) => {
				const slot = blockSlot(entry.id);
				if (!slot || local.has(entry.id)) return false;
				// A newer version of a week this browser holds.
				if (localSlots.has(slot)) return true;
				// Removed from this browser: stays removed.
				if (held.has(slot)) return false;
				// The weeks an upload from here went into, so the upload can go.
				const overlaps = (upload: ExportRecord) =>
					upload.vin === entry.vin &&
					entry.startTime <= upload.endTime &&
					entry.endTime >= upload.startTime;
				if (foldedHere.some(overlaps)) return true;
				const { car, week } = slotParts(slot);
				return week > since.get(car)!;
			});

			let pulled = 0;
			let complete = true;
			if (wanted.length > 0) {
				const result = await this.pull(wanted.map((entry) => entry.id));
				pulled = result.ids.length;
				complete = result.failed.length === 0;
				for (const id of result.ids) held.add(blockSlot(id)!);
			}

			const remote = new Set(this.remote.map((entry) => entry.id));
			const kept = new Set(this.entries.map((entry) => entry.id));
			const stale = this.entries.filter((entry) => {
				if (remote.has(entry.id)) return false;
				const slot = blockSlot(entry.id);
				if (!slot) return complete && this.folded.includes(entry.id);
				// Replaced, and the replacement is here.
				return this.remote.some((other) => blockSlot(other.id) === slot && kept.has(other.id));
			});
			if (stale.length > 0) await this.remove(stale.map((entry) => entry.id));

			const live = new Set(this.remote.map((entry) => blockSlot(entry.id)));
			rememberSlots(new Set([...held].filter((slot) => live.has(slot))));
			return pulled;
		} finally {
			this.adopting = false;
		}
	}

	private adopting = false;

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

/** Weeks pulled unasked onto a browser that holds none of a car's: about a month. */
const RECENT_WEEKS = 5;
const WEEK = 7 * 86400;

/** The car tag and week (epoch seconds) of a block slot, `wk-{week}-{car}-`. */
function slotParts(slot: string): { week: number; car: string } {
	const [, week, car] = slot.split('-');
	return { week: Number(week), car };
}

/** Block slots this browser has held. Only ids, as `logboox.last` keeps. */
const SLOTS_KEY = 'logboox.timeline.slots';

function rememberedSlots(): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '[]') as string[]);
	} catch {
		return new Set();
	}
}

function rememberSlots(slots: Set<string>): void {
	try {
		localStorage.setItem(SLOTS_KEY, JSON.stringify([...slots]));
	} catch {
		// Private windows and full storage: a removed week may come back once.
	}
}

export const history = new HistoryStore();
