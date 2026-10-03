/**
 * The logbook for the car currently on screen.
 *
 * Works signed out, which decides its shape: every note is written to this
 * browser first and told to the account afterwards, if there is one. Nothing
 * waits on a network round trip, and nothing is lost when there is no network
 * to wait on.
 *
 * Notes are held against the vehicle, not the export they were written from.
 * The same trip appears in every overlapping export, and the whole point of
 * keeping exports is joining them up.
 */

import { browser } from '$app/env';
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import { api } from '../api/client';
import { listAnnotations, putAnnotations } from '../history/db';
import { storageAvailable } from '../history/db';
import { bindAnnotations, knownPlaces } from '../logbook/keys';
import { emptyAnnotation, isBlank, type Annotation } from '../logbook/types';
import type { Trip } from '../data/analytics/trips';
import { account } from './account.svelte';
import { data } from './dataset.svelte';

/** Typing should not produce a write per keystroke, nor wait for a pause to end. */
const SAVE_DELAY_MS = 600;

class LogbookStore {
	entries = $state<Annotation[]>([]);
	vin = $state<string | null>(null);
	loaded = $state(false);
	syncing = $state(false);

	private timer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Waiting to go up, by car and then by trip. Per car so that notes for one
	 * can never be sent to another's logbook: only the open car's are ever sent.
	 */
	private pending = new Map<string, Map<number, Annotation>>();
	private pulling: { vin: string; run: Promise<void> } | null = null;

	constructor() {
		if (!browser) return;
		// The account resolves on its own schedule, usually after the dataset has
		// opened and found nobody signed in. Nothing else would ever ask again.
		$effect.root(() => {
			$effect(() => {
				if (!account.signedIn) return;
				untrack(() => {
					if (this.loaded) void this.pull();
				});
			});
		});
	}

	/**
	 * Notes attached to the trips of the open dataset. Derived, so the binding
	 * is worked out once per change rather than once per component asking.
	 */
	bound = $derived.by(() => bindAnnotations(data.derived?.trips ?? [], this.entries));

	places = $derived.by(() => knownPlaces(this.entries));

	/** How many trips in this dataset have somewhere written against them. */
	labelled = $derived.by(() => {
		let count = 0;
		for (const entry of this.bound.byTrip.values()) {
			if (entry.origin || entry.destination) count++;
		}
		return count;
	});

	/**
	 * The logbook's to-do across the whole record, whatever range is on screen:
	 * narrowing to a week should not look like a month of trips got labelled.
	 */
	record = $derived.by(() => {
		const trips = data.full?.derived.trips ?? data.derived?.trips ?? [];
		const bound = trips === data.derived?.trips ? this.bound : bindAnnotations(trips, this.entries);
		let unlabelled = 0;
		for (const trip of trips) {
			const entry = bound.byTrip.get(trip.startTime);
			if (!entry?.origin && !entry?.destination) unlabelled++;
		}
		return { trips: trips.length, unlabelled };
	});

	for(trip: Trip): Annotation {
		return (
			this.bound.byTrip.get(trip.startTime) ??
			emptyAnnotation(
				this.vin ?? '',
				trip.startTime,
				Number.isFinite(trip.odoStart) ? trip.odoStart : null
			)
		);
	}

	private bucket(vin: string): Map<number, Annotation> {
		let bucket = this.pending.get(vin);
		if (!bucket) this.pending.set(vin, (bucket = new Map()));
		return bucket;
	}

	/** Queues a note, unless one newer is already waiting. */
	private enqueue(entry: Annotation): void {
		const bucket = this.bucket(entry.vin);
		const waiting = bucket.get(entry.startTime);
		if (!waiting || waiting.updatedAt <= entry.updatedAt) bucket.set(entry.startTime, entry);
	}

	/**
	 * Reads this car's notes. Called when a dataset opens; a different car
	 * replaces what is held rather than adding to it.
	 */
	async open(vin: string): Promise<void> {
		if (!browser || !storageAvailable()) return;
		if (this.vin === vin && this.loaded) return;

		if (this.vin !== vin) {
			// A push scheduled for the last car must not find this one.
			if (this.timer) clearTimeout(this.timer);
			this.timer = null;
			this.entries = [];
		}
		this.vin = vin;
		this.loaded = false;

		try {
			const entries = await listAnnotations(vin);
			if (this.vin !== vin) return;
			this.entries = entries;
		} catch {
			if (this.vin !== vin) return;
			// Not loaded, so `save` refuses: writing a note over ones that could
			// not be read is worse than offering no place to write. The VIN
			// stays, since whoever called this may be reacting to it, and
			// changing it would call again.
			toast.error('The logbook could not be read from this browser.');
			return;
		}
		this.loaded = true;

		// Corrections first: a merge may have moved a trip under a note, and
		// rewriting it once is better than re-tolerating the drift forever.
		try {
			await this.settleRebinds(vin);
		} catch {
			// Found again, and tried again, the next time this car opens.
		}
		if (this.vin !== vin) return;
		await this.pull();
	}

	private async settleRebinds(vin: string): Promise<void> {
		const { rebound } = this.bound;
		if (rebound.length === 0) return;

		const now = Date.now();
		const writes: Annotation[] = [];
		for (const { from, entry } of rebound) {
			writes.push({ ...entry, updatedAt: now });
			// The old key becomes a tombstone, so the correction travels rather
			// than the note reappearing at both times on another device.
			writes.push({
				...entry,
				startTime: from,
				origin: '',
				destination: '',
				purpose: '',
				comment: '',
				updatedAt: now,
				deletedAt: now
			});
		}

		await putAnnotations(writes);
		// Both halves go up: a live note at the new time alone would leave the
		// old one live on the account as well.
		for (const write of writes) this.enqueue(write);
		const entries = await listAnnotations(vin);
		if (this.vin === vin) this.entries = entries;
	}

	/**
	 * Writes a note here, and queues telling the account about it. Rejects when
	 * the browser would not take it, with the note still held in memory.
	 */
	async save(entry: Annotation): Promise<void> {
		const vin = this.vin;
		// A note with no car to belong to would be sent to whichever car is
		// opened next.
		if (!vin || !this.loaded) throw new Error('There is no logbook open to keep this note in.');

		const next: Annotation = { ...entry, vin, updatedAt: Date.now() };
		// A note emptied of everything is a deletion, not a blank note: that is
		// what has to reach the other devices.
		if (isBlank(next) && !next.deletedAt) next.deletedAt = Date.now();
		if (!isBlank(next)) next.deletedAt = null;

		this.entries = [...this.entries.filter((held) => held.startTime !== next.startTime), next];

		// Queued before the write: a browser that refuses the write should not
		// also keep the note from the account.
		this.queue(next);
		await putAnnotations([next]);
	}

	/** Several notes in one write, for filling in or undoing many trips at once. */
	async saveMany(entries: Annotation[]): Promise<void> {
		const vin = this.vin;
		if (!vin || !this.loaded) throw new Error('There is no logbook open to keep these notes in.');
		if (entries.length === 0) return;

		const now = Date.now();
		const next = entries.map((entry) => {
			const note: Annotation = { ...entry, vin, updatedAt: now };
			if (isBlank(note) && !note.deletedAt) note.deletedAt = now;
			if (!isBlank(note)) note.deletedAt = null;
			return note;
		});
		const touched = new Set(next.map((note) => note.startTime));

		this.entries = [...this.entries.filter((held) => !touched.has(held.startTime)), ...next];
		for (const note of next) this.queue(note);
		await putAnnotations(next);
	}

	private queue(entry: Annotation): void {
		this.enqueue(entry);
		if (!account.signedIn || entry.vin !== this.vin) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.push(), SAVE_DELAY_MS);
	}

	/** Sends what has changed, and takes back whatever the account knows. */
	async push(): Promise<void> {
		const vin = this.vin;
		if (!account.signedIn || !vin) return;
		const bucket = this.pending.get(vin);
		if (!bucket || bucket.size === 0) return;

		const entries = [...bucket.values()];
		bucket.clear();
		this.syncing = true;
		try {
			const body = await api<{ entries: Annotation[] }>(
				`/api/v1/vehicles/${encodeURIComponent(vin)}/logbook`,
				{ method: 'PUT', body: { entries } }
			);
			await this.absorb(vin, body.entries, entries);
		} catch {
			// Put them back: an offline edit should go up on the next attempt
			// rather than being quietly dropped. Whatever was edited meanwhile is
			// newer, and stays.
			for (const entry of entries) this.enqueue(entry);
		} finally {
			this.syncing = false;
		}
	}

	/** Reads the account's copy and merges it into this browser's. */
	pull(): Promise<void> {
		const vin = this.vin;
		if (!account.signedIn || !vin) return Promise.resolve();
		// The dataset opening and the account resolving can both ask at once.
		if (this.pulling?.vin === vin) return this.pulling.run;

		const run = this.fetchAndAbsorb(vin).finally(() => {
			if (this.pulling?.run === run) this.pulling = null;
		});
		this.pulling = { vin, run };
		return run;
	}

	private async fetchAndAbsorb(vin: string): Promise<void> {
		this.syncing = true;
		try {
			const body = await api<{ entries: Annotation[] }>(
				`/api/v1/vehicles/${encodeURIComponent(vin)}/logbook`
			);
			await this.absorb(vin, body.entries);
		} catch {
			// The notes in this browser are the ones that matter; the account is
			// a copy, and it will be read again next time.
		} finally {
			this.syncing = false;
		}
	}

	/**
	 * Last writer wins, in both directions, by the clock on the note.
	 *
	 * `sent` is what the response answers. The server clamps a note's time to
	 * its own clock, so a note from a fast clock comes back older than it went;
	 * queueing it again on that evidence would loop forever.
	 */
	private async absorb(
		vin: string,
		incoming: Annotation[],
		sent: Annotation[] = []
	): Promise<void> {
		if (this.vin !== vin) return;
		const answered = new Map(sent.map((entry) => [entry.startTime, entry.updatedAt]));
		const held = new Map(this.entries.map((entry) => [entry.startTime, entry]));
		const returned = new Set<number>();
		const writes: Annotation[] = [];

		for (const entry of incoming) {
			returned.add(entry.startTime);
			const mine = held.get(entry.startTime);
			if (!mine || mine.updatedAt < entry.updatedAt) {
				writes.push({ ...entry, vin });
			} else if (
				mine.updatedAt > entry.updatedAt &&
				answered.get(mine.startTime) !== mine.updatedAt
			) {
				// Newer here than there: edited while offline or signed out. The
				// account holds the old text until this goes up.
				this.enqueue(mine);
			}
		}

		// Anything this browser has that the account did not send back is new to
		// it, and goes up too.
		for (const mine of held.values()) {
			if (returned.has(mine.startTime)) continue;
			if (answered.get(mine.startTime) !== mine.updatedAt) this.enqueue(mine);
		}

		if (writes.length > 0) await putAnnotations(writes);
		if (this.vin !== vin) return;

		// Merged into what is held now, not what was held before the write: a
		// note saved while it was in flight is newer than either.
		const current = new Map(this.entries.map((entry) => [entry.startTime, entry]));
		for (const write of writes) {
			const mine = current.get(write.startTime);
			if (!mine || mine.updatedAt < write.updatedAt) current.set(write.startTime, write);
		}
		this.entries = [...current.values()];

		if (this.pending.get(vin)?.size) await this.push();
	}

	reset(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.pending.clear();
		this.entries = [];
		this.vin = null;
		this.loaded = false;
	}
}

export const logbook = new LogbookStore();
