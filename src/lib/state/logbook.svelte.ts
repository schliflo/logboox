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

import { browser } from '$app/environment';
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
	private pending = new Map<number, Annotation>();

	/** Notes attached to the trips of the open dataset. */
	get bound() {
		const trips = data.derived?.trips ?? [];
		return bindAnnotations(trips, this.entries);
	}

	get places(): string[] {
		return knownPlaces(this.entries);
	}

	/** How many trips in this dataset have somewhere written against them. */
	get labelled(): number {
		let count = 0;
		for (const entry of this.bound.byTrip.values()) {
			if (entry.origin || entry.destination) count++;
		}
		return count;
	}

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

	/**
	 * Reads this car's notes. Called when a dataset opens; a different car
	 * replaces what is held rather than adding to it.
	 */
	async open(vin: string): Promise<void> {
		if (!browser || !storageAvailable()) return;
		if (this.vin === vin && this.loaded) return;

		this.vin = vin;
		this.loaded = false;
		this.entries = await listAnnotations(vin);
		this.loaded = true;

		// Corrections first: a merge may have moved a trip under a note, and
		// rewriting it once is better than re-tolerating the drift forever.
		await this.settleRebinds();
		await this.pull();
	}

	private async settleRebinds(): Promise<void> {
		const { rebound } = this.bound;
		if (rebound.length === 0) return;

		const writes: Annotation[] = [];
		for (const { from, entry } of rebound) {
			writes.push({ ...entry, updatedAt: Date.now() });
			// The old key becomes a tombstone, so the correction travels rather
			// than the note reappearing at both times on another device.
			writes.push({
				...entry,
				startTime: from,
				origin: '',
				destination: '',
				purpose: '',
				comment: '',
				updatedAt: Date.now(),
				deletedAt: Date.now()
			});
		}

		await putAnnotations(writes);
		this.entries = await listAnnotations(this.vin!);
	}

	/** Writes a note here, and queues telling the account about it. */
	async save(entry: Annotation): Promise<void> {
		const next: Annotation = { ...entry, vin: this.vin ?? entry.vin, updatedAt: Date.now() };
		// A note emptied of everything is a deletion, not a blank note: that is
		// what has to reach the other devices.
		if (isBlank(next) && !next.deletedAt) next.deletedAt = Date.now();
		if (!isBlank(next)) next.deletedAt = null;

		this.entries = [...this.entries.filter((held) => held.startTime !== next.startTime), next];

		await putAnnotations([next]);
		this.queue(next);
	}

	private queue(entry: Annotation): void {
		this.pending.set(entry.startTime, entry);
		if (!account.signedIn) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.push(), SAVE_DELAY_MS);
	}

	/** Sends what has changed, and takes back whatever the account knows. */
	async push(): Promise<void> {
		if (!account.signedIn || !this.vin || this.pending.size === 0) return;

		const entries = [...this.pending.values()];
		this.pending.clear();
		this.syncing = true;
		try {
			const body = await api<{ entries: Annotation[] }>(
				`/api/v1/vehicles/${encodeURIComponent(this.vin)}/logbook`,
				{ method: 'PUT', body: { entries } }
			);
			await this.absorb(body.entries);
		} catch {
			// Put them back: an offline edit should go up on the next attempt
			// rather than being quietly dropped.
			for (const entry of entries) this.pending.set(entry.startTime, entry);
		} finally {
			this.syncing = false;
		}
	}

	/** Reads the account's copy and merges it into this browser's. */
	async pull(): Promise<void> {
		if (!account.signedIn || !this.vin) return;
		this.syncing = true;
		try {
			const body = await api<{ entries: Annotation[] }>(
				`/api/v1/vehicles/${encodeURIComponent(this.vin)}/logbook`
			);
			await this.absorb(body.entries);
		} catch {
			// The notes in this browser are the ones that matter; the account is
			// a copy, and it will be read again next time.
		} finally {
			this.syncing = false;
		}
	}

	/** Last writer wins, in both directions, by the clock on the note. */
	private async absorb(incoming: Annotation[]): Promise<void> {
		if (!this.vin) return;
		const held = new Map(this.entries.map((entry) => [entry.startTime, entry]));
		const writes: Annotation[] = [];

		for (const entry of incoming) {
			const mine = held.get(entry.startTime);
			if (mine && mine.updatedAt >= entry.updatedAt) continue;
			const merged: Annotation = { ...entry, vin: this.vin };
			held.set(entry.startTime, merged);
			writes.push(merged);
		}

		if (writes.length > 0) await putAnnotations(writes);
		this.entries = [...held.values()];

		// Anything this browser has that the account did not send back is new to
		// it, and goes up on the next push.
		const known = new Set(incoming.map((entry) => entry.startTime));
		for (const entry of this.entries) {
			if (!known.has(entry.startTime)) this.pending.set(entry.startTime, entry);
		}
		if (this.pending.size > 0) await this.push();
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
