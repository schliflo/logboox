/**
 * The loaded export, held in memory for the life of the tab.
 *
 * Reading an export involves no server: it is parsed by a worker in this page,
 * and a copy is kept in this browser's own storage so it can be reopened
 * later. Removing that copy is a click.
 *
 * A signed-in reader may additionally keep a copy in their account, which is
 * the only way anything here travels. That is opt-in, per export, and lives
 * behind `sync` — never on the path a first-time reader takes.
 *
 * What is on screen may be narrower than what was loaded, and usually is: an
 * export opens on its last thirty days (or seven), see `defaultRange`. A time
 * range is a view: the loaded export stays in `full`, a slice of it is
 * analysed afresh, and `dataset` and `derived` are swapped for the result, so
 * pages read them as they are and need not know a range exists. Only what
 * names a position in the whole (links to a trip, the highlights page) has to
 * look at `full`. Nothing kept, synced or shared is ever cut down by it.
 */

import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import {
	analyzeView,
	loadDemo,
	loadFiles,
	openKept,
	openShared,
	type LoadProgress
} from '../data/client';
import type { KeptOutcome } from '../data/worker/protocol';
import type { DerivedData } from '../data/analytics';
import { restrictDataset, type Dataset } from '../data/store/columnar';
import { defaultRange, snapToSpans, type TimeRange } from '../data/range';
import { PyramidCache } from '../data/store/decimate';
import { account } from './account.svelte';
import { history } from './history.svelte';
import { settings } from './settings.svelte';

type Status = 'empty' | 'loading' | 'ready' | 'error';

/** Where the data on screen came from, which is what the labels report. */
export type SourceKind = 'fresh' | 'reopened' | 'merged' | 'shared';

export interface DataSource {
	kind: SourceKind;
	/** The exports behind it: one, or several once merged. */
	ids: string[];
	demo: boolean;
}

/**
 * What was on screen, so a reload or a bookmark into the dashboard can open it
 * again instead of starting over: which kept exports, and which range. Only
 * ids and dates — the data itself is in IndexedDB, and only there.
 */
const LAST_KEY = 'logboox.last';

interface Last {
	ids: string[];
	/** The range on screen; null for everything, absent when never chosen. */
	range?: TimeRange | null;
}

function recall(): Last | null {
	try {
		const raw = localStorage.getItem(LAST_KEY);
		return raw ? (JSON.parse(raw) as Last) : null;
	} catch {
		return null;
	}
}

function remember(patch: Partial<Last>): void {
	try {
		const next = { ...(recall() ?? { ids: [] }), ...patch };
		localStorage.setItem(LAST_KEY, JSON.stringify(next));
	} catch {
		// Private windows and full storage: a reload will start from the beginning.
	}
}

/** Whether a dashboard opened cold here has something to reopen. */
export function hasRecord(): boolean {
	return (recall()?.ids.length ?? 0) > 0;
}

/** The most a whole record opened in one go may ask of a tab. */
const RECORD_BUDGET = 1024 * 1024 * 1024;

/**
 * The exports that make up a car's record as it is opened in one go: the
 * newest first, stopping before the tab would have to hold more than it
 * sensibly can. Without a VIN, the newest car's — a real one over the
 * demonstration month whenever there is one.
 */
export function recordIds(vin?: string): string[] {
	const real = history.entries.filter((entry) => !entry.isDemo);
	const candidates = real.length > 0 ? real : history.entries;
	const car = vin ?? [...candidates].sort((a, b) => b.endTime - a.endTime)[0]?.vin;
	if (!car) return [];
	const ids: string[] = [];
	for (const entry of candidates
		.filter((other) => other.vin === car)
		.sort((a, b) => b.endTime - a.endTime)) {
		if (ids.length > 0 && history.estimate([...ids, entry.id]).bytes > RECORD_BUDGET) break;
		ids.push(entry.id);
	}
	return ids;
}

class DatasetStore {
	status = $state<Status>('empty');
	progress = $state<LoadProgress | null>(null);
	// Raw: both are large and only ever replaced whole, never edited in place,
	// so there is nothing for a deep proxy to watch and a swap stays cheap.
	dataset = $state.raw<Dataset | null>(null);
	derived = $state.raw<DerivedData | null>(null);
	error = $state<{ message: string; hint?: string } | null>(null);
	source = $state<DataSource>({ kind: 'fresh', ids: [], demo: false });

	/** The export exactly as loaded, whatever range is on screen. */
	full = $state.raw<{ dataset: Dataset; derived: DerivedData } | null>(null);
	/** The stretch on screen; null means all of it. */
	range = $state<TimeRange | null>(null);
	/** True while a range is being analysed; the previous view stays up meanwhile. */
	refining = $state(false);

	/** Built lazily per charted column and thrown away with the dataset. */
	pyramids: PyramidCache | null = null;

	/** Bumped by every range request, so a slower earlier answer can be told apart. */
	private generation = 0;

	get isReady(): boolean {
		return this.status === 'ready' && this.dataset !== null && this.derived !== null;
	}

	/** True when the data is generated rather than a real export. */
	get isDemo(): boolean {
		return this.source.demo;
	}

	private begin() {
		this.status = 'loading';
		this.error = null;
		this.progress = null;
		this.dataset = null;
		this.derived = null;
		this.pyramids = null;
		this.clearRange();
	}

	private settle(dataset: Dataset, derived: DerivedData, source: DataSource) {
		// Someone else's export is never kept here, so there is nothing to reopen.
		if (source.kind !== 'shared') remember({ ids: source.ids, range: undefined });
		this.full = { dataset, derived };
		this.show(dataset, derived);
		this.source = source;
		this.progress = null;
		this.status = 'ready';
	}

	/** Swaps what the pages read. Pyramids first: pages fetch them while reacting to the dataset. */
	private show(dataset: Dataset, derived: DerivedData) {
		this.pyramids = new PyramidCache(dataset.time);
		this.derived = derived;
		this.dataset = dataset;
	}

	private clearRange() {
		this.generation++;
		this.full = null;
		this.range = null;
		this.refining = false;
	}

	/**
	 * Narrows everything on screen to a range, or with null widens it back to
	 * the whole export. The current view stays up while the worker analyses
	 * the slice, and `status` never leaves 'ready': the dashboard unmounts
	 * whatever it is showing when it does. When ranges are picked faster than
	 * they are analysed, only the last one lands.
	 *
	 * `quiet` is for a range nobody asked for: a failure leaves the view as it
	 * is without saying so.
	 */
	async setRange(range: TimeRange | null, { quiet = false } = {}) {
		const full = this.full;
		if (!full || this.status !== 'ready') return;

		// A range around every sample is everything, without a copy to analyse.
		const { time } = full.dataset;
		if (range && range.from <= time[0] && range.to > time[time.length - 1]) range = null;

		if (!quiet) remember({ range });

		if (!range) {
			this.generation++;
			this.refining = false;
			this.show(full.dataset, full.derived);
			this.range = null;
			return;
		}

		const ticket = ++this.generation;
		// Slicing copies and re-summarises every column on this thread, long
		// enough to freeze the page: say so first, and let it be drawn.
		this.refining = true;
		try {
			await tick();
			await new Promise<void>((resolve) => setTimeout(resolve));
			if (ticket !== this.generation) return;

			// A drive or a charge across midnight stays whole, with the day it began.
			const edges = snapToSpans(range.from, range.to, [
				...full.derived.trips,
				...full.derived.charging.sessions
			]);
			const slice = restrictDataset(full.dataset, edges.from, edges.to);
			if (slice.time.length < 2) {
				if (!quiet) {
					toast('Nothing was recorded then', {
						description: `${range.label} holds too little data to show on its own.`
					});
				}
				return;
			}

			const result = await analyzeView(slice, settings.timeZone);
			if (ticket !== this.generation) return;
			this.show(result.dataset, result.derived);
			this.range = range;
		} catch (error) {
			if (ticket !== this.generation || quiet) return;
			toast('That range could not be shown', {
				description: error instanceof Error ? error.message : undefined,
				closeButton: true
			});
		} finally {
			if (ticket === this.generation) this.refining = false;
		}
	}

	/**
	 * Opens an export on its default stretch. Awaited before the first page is
	 * shown, so the whole export is never drawn first; it is a default rather
	 * than a choice, so when it cannot be applied the whole export stays.
	 */
	private async applyDefaultRange() {
		const derived = this.full?.derived;
		if (derived) await this.setRange(defaultRange(derived, settings.timeZone), { quiet: true });
	}

	/**
	 * Makes sure a trip or a charging session is in the view, for a link that
	 * names one. Ranges never cut one, so it is either wholly in or wholly
	 * out; when it is out but exists in the export the view is widened to
	 * everything. False when it exists nowhere.
	 */
	reveal(kind: 'trip' | 'charging', startTime: number): boolean {
		const full = this.full?.derived;
		if (!full) return false;
		const list = kind === 'trip' ? full.trips : full.charging.sessions;
		if (!list.some((item) => item.startTime === startTime)) return false;
		if (this.range) void this.setRange(null);
		return true;
	}

	private fail(error: unknown) {
		this.error = {
			message: error instanceof Error ? error.message : 'Something went wrong.',
			hint: error instanceof Error && 'hint' in error ? (error.hint as string) : undefined
		};
		this.status = 'error';
		this.progress = null;
	}

	/**
	 * Says what happened to the copy. The first one is worth announcing, since
	 * it changes what closing the tab means; a failure is worth announcing
	 * because the export on screen is then the only copy there is.
	 */
	private async afterKeep(kept: KeptOutcome | null) {
		if (!kept) return;

		if (!kept.ok) {
			toast('This export was not kept', {
				description: `${kept.reason} You can still read it now, but it will be gone when the tab closes.`,
				duration: 8000,
				closeButton: true
			});
			return;
		}

		// What reopens after a reload is the kept copy, under the id it was kept as.
		if (this.source.kind === 'fresh') remember({ ids: [kept.id] });
		const first = history.entries.length === 0;
		await history.requestPersistence();
		await history.refresh();

		if (first) {
			toast('Kept in this browser', {
				description:
					'This export is now stored on your device, so you can reopen it without dropping the files in again. Remove it whenever you like from the start page.',
				duration: 8000,
				closeButton: true
			});
		}

		await this.copyToAccount(kept.id);
	}

	/**
	 * Copies a freshly imported export up, when someone is signed in and has
	 * asked for that. It runs after the dashboard is already on screen and
	 * failure is reported rather than thrown: the export is readable either
	 * way, and an upload is not something to be waited on.
	 *
	 * The demonstration month is never copied. It is generated from a seed, so
	 * an account holding it would be storing something anyone can regenerate
	 * under a VIN every demo reader shares.
	 */
	private async copyToAccount(id: string) {
		if (!account.signedIn || !account.user?.autoSync) return;
		if (this.source.demo) return;

		try {
			const result = await history.sync([id]);
			if (result.failed.length > 0) {
				toast('This export was not copied to your account', {
					description: result.failed[0].reason,
					closeButton: true
				});
			}
		} catch {
			// Reported by the library the next time it is listed; nothing here
			// is worth interrupting a first read for.
		}
	}

	async load(files: File[]) {
		this.begin();
		try {
			const result = await loadFiles(files, settings.timeZone, (progress) => {
				this.progress = progress;
			});

			if (result.kind === 'restored') {
				this.status = 'empty';
				this.progress = null;
				await history.refresh();
				const count = result.ids.length;
				toast(count === 1 ? 'Restored one export' : `Restored ${count} exports`, {
					description: result.skipped.length
						? `${result.skipped.length} could not be read by this version of the app.`
						: 'They are listed below, ready to open.'
				});
				return;
			}

			this.settle(result.dataset, result.derived, {
				kind: 'fresh',
				ids: [result.dataset.exportId],
				demo: false
			});
			await this.applyDefaultRange();
			await goto('/wrapped');
			await this.afterKeep(result.kept);
		} catch (error) {
			this.fail(error);
		}
	}

	/**
	 * Adds newly dropped files to the record on screen rather than replacing it.
	 *
	 * The files are read and kept like any other, and then every export of the
	 * same car this browser holds is opened as one timeline. Nobody should have
	 * to know which files a month came in; they see one continuous record that
	 * got longer. When nothing else of that car is kept here — or the new copy
	 * could not be kept — what was dropped is shown on its own.
	 */
	async extend(files: File[]) {
		await goto('/');
		this.begin();
		try {
			const result = await loadFiles(files, settings.timeZone, (progress) => {
				this.progress = progress;
			});

			if (result.kind === 'restored') {
				this.status = 'empty';
				this.progress = null;
				await history.refresh();
				toast(
					result.ids.length === 1 ? 'Restored one export' : `Restored ${result.ids.length} exports`
				);
				return;
			}

			await this.afterKeep(result.kept);
			const record = recordIds(result.dataset.vin);

			if (result.kept?.ok && record.length > 1 && record.includes(result.kept.id)) {
				await this.open(record);
				return;
			}

			this.settle(result.dataset, result.derived, {
				kind: 'fresh',
				ids: [result.dataset.exportId],
				demo: false
			});
			await this.applyDefaultRange();
			await goto('/dash/overview');
		} catch (error) {
			this.fail(error);
		}
	}

	/**
	 * Opens the newest car's whole record: every export of it kept in this
	 * browser, as one timeline. What "pick up where you left off" means.
	 */
	async openRecord() {
		await this.open(recordIds());
	}

	async loadDemoData() {
		this.begin();
		try {
			const result = await loadDemo(settings.timeZone, (progress) => {
				this.progress = progress;
			});
			this.settle(result.dataset, result.derived, {
				kind: 'fresh',
				ids: [result.dataset.exportId],
				demo: true
			});
			await this.applyDefaultRange();
			await goto('/wrapped');
			await this.afterKeep(result.kept);
		} catch (error) {
			this.fail(error);
		}
	}

	/**
	 * Reopens exports already kept here. Several at once are merged into one
	 * timeline, which is the only way to see more than the thirty days any
	 * single export covers.
	 */
	/**
	 * Opens what was on screen last time, landing on `to`, for a dashboard
	 * address opened cold. False when there is nothing kept to go back to.
	 */
	async restore(to: string): Promise<boolean> {
		const last = recall();
		if (!last || last.ids.length === 0) return false;
		await history.refresh();
		if (!history.openable(last.ids)) return false;
		await this.open(last.ids, to);
		if (this.status === 'ready' && last.range !== undefined) await this.setRange(last.range);
		return this.status === 'ready';
	}

	async open(ids: string[], to = '/dash/overview') {
		if (ids.length === 0) return;
		this.begin();
		try {
			const known = history.entries.filter((entry) => ids.includes(entry.id));
			const result = await openKept(ids, settings.timeZone, (progress) => {
				this.progress = progress;
			});
			this.settle(result.dataset, result.derived, {
				kind: ids.length > 1 ? 'merged' : 'reopened',
				ids,
				demo: known.length > 0 && known.every((entry) => entry.isDemo)
			});
			await this.applyDefaultRange();
			// Straight to the dashboard: the opening sequence is for the moment
			// an export is first read, not for every time it is picked up again.
			await goto(to);
		} catch (error) {
			this.fail(error);
		}
	}

	/**
	 * Opens an export someone published. It is held for the life of the tab and
	 * never kept: it is not this reader's data, and a link should not quietly
	 * fill their browser with someone else's month.
	 */
	async openSharedExport(shareId: string) {
		this.begin();
		try {
			const result = await openShared(shareId, settings.timeZone, (progress) => {
				this.progress = progress;
			});
			this.settle(result.dataset, result.derived, { kind: 'shared', ids: [shareId], demo: false });
			await this.applyDefaultRange();
			await goto('/dash/overview');
		} catch (error) {
			this.fail(error);
		}
	}

	reset() {
		this.status = 'empty';
		this.dataset = null;
		this.derived = null;
		this.error = null;
		this.progress = null;
		this.pyramids = null;
		this.clearRange();
		this.source = { kind: 'fresh', ids: [], demo: false };
	}
}

export const data = new DatasetStore();
