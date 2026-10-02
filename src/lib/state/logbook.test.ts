/**
 * What the logbook sends to the account, and to which car's.
 *
 * Everything the store talks to is replaced: a browser database that is a map,
 * an account that is a flag, and a server that answers from a list.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../logbook/types';

const mocks = vi.hoisted(() => ({
	stored: new Map<string, unknown>(),
	account: { signedIn: false },
	data: { derived: null as null | { trips: unknown[] } },
	api: vi.fn(),
	failWrites: false,
	failReads: false,
	reads: 0,
	toast: vi.fn()
}));

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('svelte-sonner', () => ({ toast: { error: mocks.toast } }));
vi.mock('../api/client', () => ({ api: mocks.api }));
vi.mock('./account.svelte', () => ({ account: mocks.account }));
vi.mock('./dataset.svelte', () => ({ data: mocks.data }));
vi.mock('../history/db', () => ({
	storageAvailable: () => true,
	listAnnotations: async (vin: string) => {
		mocks.reads++;
		if (mocks.failReads) throw new Error('blocked');
		return [...mocks.stored.values()].filter((entry) => (entry as Annotation).vin === vin);
	},
	putAnnotations: async (entries: Annotation[]) => {
		if (mocks.failWrites) throw new Error('quota');
		for (const entry of entries) mocks.stored.set(`${entry.vin}|${entry.startTime}`, { ...entry });
	}
}));

const { logbook } = await import('./logbook.svelte');

const CAR_A = 'L1NTEST00000000001';
const CAR_B = 'L1NTEST00000000002';

function note(vin: string, startTime: number, extra: Partial<Annotation> = {}): Annotation {
	return {
		vin,
		startTime,
		odoStart: 100,
		origin: 'Home',
		destination: 'Office',
		purpose: '',
		comment: '',
		updatedAt: 1000,
		deletedAt: null,
		...extra
	};
}

function seed(...entries: Annotation[]) {
	for (const entry of entries) mocks.stored.set(`${entry.vin}|${entry.startTime}`, entry);
}

/** The server holds `rows` for GET, and merges what a PUT sends into them. */
function server(rows: Annotation[] = [], options: { clamp?: number } = {}) {
	const held = new Map(rows.map((row) => [row.startTime, row]));
	mocks.api.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
		if (init?.method === 'PUT') {
			const sent = (init.body as { entries: Annotation[] }).entries;
			for (const entry of sent) {
				const stored = {
					...entry,
					updatedAt: Math.min(entry.updatedAt, options.clamp ?? Infinity)
				};
				const mine = held.get(entry.startTime);
				if (!mine || stored.updatedAt > mine.updatedAt) held.set(entry.startTime, stored);
			}
		}
		return { entries: [...held.values()] };
	});
}

const puts = () =>
	mocks.api.mock.calls.filter(([, init]) => init?.method === 'PUT') as Array<
		[string, { body: { entries: Annotation[] } }]
	>;

beforeEach(() => {
	logbook.reset();
	mocks.stored.clear();
	mocks.api.mockReset();
	mocks.toast.mockReset();
	mocks.account.signedIn = false;
	mocks.data.derived = null;
	mocks.failWrites = false;
	mocks.failReads = false;
	mocks.reads = 0;
});

afterEach(() => logbook.reset());

describe('a note newer here than on the account', () => {
	it('is uploaded when the book is next pulled', async () => {
		// Edited while signed out; the account still has the old text.
		seed(note(CAR_A, 1000, { origin: 'Home (new)', updatedAt: 2000 }));
		server([note(CAR_A, 1000, { updatedAt: 1000 })]);
		mocks.account.signedIn = true;

		await logbook.open(CAR_A);

		expect(puts()).toHaveLength(1);
		expect(puts()[0][1].body.entries[0]).toMatchObject({ origin: 'Home (new)', updatedAt: 2000 });
		expect(logbook.entries[0].origin).toBe('Home (new)');
	});

	it('is not sent again when the server clamps its time and sends it back older', async () => {
		// A clock running ahead: the server stores the note at its own time,
		// which is earlier than the note says. That must not start a loop.
		seed(note(CAR_A, 1000, { updatedAt: 9000 }));
		server([note(CAR_A, 1000, { updatedAt: 1000, comment: 'old' })], { clamp: 5000 });
		mocks.account.signedIn = true;

		await logbook.open(CAR_A);

		expect(puts()).toHaveLength(1);
	});

	it('takes the account copy when that is the newer one', async () => {
		seed(note(CAR_A, 1000, { updatedAt: 1000 }));
		server([note(CAR_A, 1000, { updatedAt: 3000, origin: 'Elsewhere' })]);
		mocks.account.signedIn = true;

		await logbook.open(CAR_A);

		expect(puts()).toHaveLength(0);
		expect(logbook.entries[0].origin).toBe('Elsewhere');
	});
});

describe('a note moved to a new start time', () => {
	it('sends the tombstone at the old time as well as the note at the new one', async () => {
		seed(note(CAR_A, 1000, { odoStart: 100 }));
		mocks.data.derived = { trips: [{ startTime: 1005, odoStart: 100 }] };
		// Signed in, but the pull fails: only the rebind can have queued these.
		mocks.account.signedIn = true;
		mocks.api.mockRejectedValueOnce(new Error('offline'));

		await logbook.open(CAR_A);
		server();
		await logbook.push();

		const sent = puts()[0][1].body.entries;
		expect(sent.find((entry) => entry.startTime === 1005)?.deletedAt).toBeNull();
		expect(sent.find((entry) => entry.startTime === 1000)?.deletedAt).toEqual(expect.any(Number));
	});
});

describe('notes and cars', () => {
	it("never sends one car's notes to another's logbook", async () => {
		await logbook.open(CAR_A);
		await logbook.save(note(CAR_A, 1000, { updatedAt: 1 }));

		await logbook.open(CAR_B);
		server();
		mocks.account.signedIn = true;
		await logbook.pull();
		await logbook.push();

		for (const [path, init] of puts()) {
			expect(path).toContain(CAR_B);
			expect(init.body.entries).toEqual([]);
		}
		expect(puts()).toHaveLength(0);
	});

	it('refuses a note when no car is open', async () => {
		await expect(logbook.save(note('', 1000))).rejects.toThrow();
		expect(mocks.stored.size).toBe(0);
	});
});

describe('a note the browser will not keep', () => {
	it('still goes to the account, and is still held in memory', async () => {
		server();
		mocks.account.signedIn = true;
		await logbook.open(CAR_A);
		mocks.failWrites = true;

		await expect(logbook.save(note(CAR_A, 1000, { updatedAt: 1 }))).rejects.toThrow('quota');
		expect(logbook.entries).toHaveLength(1);

		await logbook.push();
		expect(puts()[0][1].body.entries[0]).toMatchObject({ startTime: 1000, origin: 'Home' });
	});
});

describe('a book that cannot be read', () => {
	it('is tried once, keeps the car it was asked for, and takes no notes', async () => {
		mocks.failReads = true;

		await logbook.open(CAR_A);

		// The layout's effect reads `vin`; changing it here would call `open` again, forever.
		expect(logbook.vin).toBe(CAR_A);
		expect(logbook.loaded).toBe(false);
		expect(mocks.reads).toBe(1);
		expect(mocks.toast).toHaveBeenCalledTimes(1);
		await expect(logbook.save(note(CAR_A, 1000))).rejects.toThrow();
		expect(mocks.stored.size).toBe(0);
	});

	it('is read again the next time it is asked for', async () => {
		mocks.failReads = true;
		await logbook.open(CAR_A);
		mocks.failReads = false;
		seed(note(CAR_A, 1000));

		await logbook.open(CAR_A);

		expect(logbook.loaded).toBe(true);
		expect(logbook.entries).toHaveLength(1);
	});
});
