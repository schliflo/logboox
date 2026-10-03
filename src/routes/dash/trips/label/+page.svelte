<!--
  Labelling, one trip at a time.

  The list is for looking things up; this is for getting through a backlog.
  One trip fills the screen, with the places the logbook would guess already
  filled in, and picking a purpose saves the trip and moves to the next. On a
  phone that is one tap per trip for anything habitual, which is most trips.

  The queue is taken when the page opens, oldest first, so a trip just saved
  becomes "where the last trip ended" for the one after it, and nothing jumps
  around underneath the reader as trips leave the unlabelled list.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { PURPOSE_COLOR } from '#lib/components/app/PurposeChip.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { logbook } from '#lib/state/logbook.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import {
		labelled,
		suggestDestinations,
		suggestOrigin,
		suggestPurpose
	} from '#lib/logbook/suggest.js';
	import { PURPOSES, type Purpose } from '#lib/logbook/types.js';
	import { tripLink } from '#lib/data/range.js';
	import { duration, fullDateTime, num, timeOnly } from '#lib/utils/format.js';
	import { toast } from 'svelte-sonner';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import WandIcon from '@lucide/svelte/icons/wand-sparkles';

	const trips = $derived(data.derived?.trips ?? []);
	const notes = $derived(logbook.bound.byTrip);
	const shared = $derived(data.source.kind === 'shared');

	/** Taken once, when the logbook is ready: the order must not shift under the reader. */
	let queue = $state<number[] | null>(null);
	$effect(() => {
		if (queue !== null || !logbook.loaded) return;
		untrack(() => {
			queue = [...trips]
				.filter((trip) => !labelled(notes.get(trip.startTime)))
				.sort((a, b) => a.startTime - b.startTime)
				.map((trip) => trip.startTime);
		});
	});

	let at = $state(0);
	let saved = $state(0);
	let skipped = $state(0);

	const trip = $derived(
		queue && at < queue.length ? (trips.find((t) => t.startTime === queue![at]) ?? null) : null
	);
	const done = $derived(queue !== null && at >= queue.length);

	const origins = $derived(trip ? suggestOrigin(trip, trips, notes, settings.timeZone) : []);
	let from = $state('');
	let to = $state('');
	let toTouched = $state(false);
	const destinations = $derived(
		trip ? suggestDestinations(trip, trips, notes, settings.timeZone, from) : []
	);
	const suggested = $derived(trip ? suggestPurpose(trip, trips, notes, settings.timeZone) : '');

	// Each trip starts from the logbook's best guess, which the reader only has to correct.
	let filledFor: number | null = null;
	$effect(() => {
		const current = trip?.startTime ?? null;
		if (current === filledFor) return;
		filledFor = current;
		untrack(() => {
			const note = current === null ? undefined : notes.get(current);
			from = note?.origin || origins[0]?.value || '';
			to = note?.destination || '';
			// A destination already written down is the reader's, not a guess to follow.
			toTouched = Boolean(note?.destination);
		});
	});
	// The destination guess depends on the start, so it follows a changed start until typed over.
	$effect(() => {
		const best = destinations[0]?.value ?? '';
		if (!toTouched) to = best;
	});

	async function save(purpose: Purpose | '') {
		if (!trip) return;
		try {
			await logbook.save({
				...logbook.for(trip),
				origin: from.trim(),
				destination: to.trim(),
				purpose
			});
		} catch {
			toast.error('That trip could not be saved in this browser.');
			return;
		}
		saved++;
		at++;
	}

	function skip() {
		skipped++;
		at++;
	}

	function back() {
		if (at > 0) at--;
	}

	function keys(event: KeyboardEvent) {
		if (!trip || event.metaKey || event.ctrlKey || event.altKey) return;
		const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select');
		if (typing && event.key !== 'Enter') return;
		const index = ['1', '2', '3'].indexOf(event.key);
		if (index >= 0 && !typing) {
			event.preventDefault();
			void save(PURPOSES[index].value);
		} else if (event.key === 'Enter' && (from.trim() || to.trim())) {
			event.preventDefault();
			void save(suggested || '');
		}
	}

	const progress = $derived(queue && queue.length > 0 ? Math.min(1, at / queue.length) : 0);
</script>

<svelte:window onkeydown={keys} />

<div class="mx-auto flex max-w-xl flex-col gap-6">
	<div class="flex items-center gap-3">
		<a
			href="/dash/trips"
			class={buttonVariants({ variant: 'ghost', size: 'icon' })}
			aria-label="Stop labelling"
		>
			<XIcon class="size-5" />
		</a>
		<div
			class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={queue?.length ?? 0}
			aria-valuenow={at}
			aria-label="Trips labelled"
		>
			<div
				class="h-full rounded-full transition-[width]"
				style="width: {progress * 100}%; background: var(--viz-1)"
			></div>
		</div>
		<span class="w-16 text-right text-sm text-muted-foreground tabular-nums">
			{#if queue}{Math.min(at + 1, queue.length)} / {queue.length}{/if}
		</span>
	</div>

	{#if shared}
		<p class="text-muted-foreground">A shared export has no logbook of yours to fill in.</p>
	{:else if !logbook.loaded || queue === null}
		<p class="text-muted-foreground">Opening the logbook…</p>
	{:else if queue.length === 0}
		<div class="space-y-3 rounded-2xl border bg-card p-8 text-center">
			<p class="text-xl font-semibold">Every trip in view already has a place</p>
			<a href="/dash/trips" class={buttonVariants()}>Back to the trips</a>
		</div>
	{:else if done}
		<div class="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center">
			<span
				class="grid size-16 place-items-center rounded-full"
				style="background: color-mix(in oklab, var(--viz-3) 18%, transparent); color: var(--viz-3)"
			>
				<CheckIcon class="size-8" />
			</span>
			<p class="text-2xl font-bold tracking-tight">
				{saved === 1 ? 'One trip' : `${saved} trips`} labelled
			</p>
			<p class="text-muted-foreground">
				{#if skipped > 0}
					{skipped} skipped for later.
				{/if}
				Your logbook can be downloaded from the trip list, ready for the tax office.
			</p>
			<div class="flex flex-wrap justify-center gap-2">
				<a href="/dash/trips" class={buttonVariants({ size: 'lg' })}>Go to the logbook</a>
				{#if skipped > 0}
					<Button
						variant="ghost"
						size="lg"
						onclick={() => {
							queue = null;
							at = 0;
							saved = 0;
							skipped = 0;
						}}
					>
						Go through the skipped ones
					</Button>
				{/if}
			</div>
		</div>
	{:else if trip}
		<section aria-labelledby="which" class="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
			<div>
				<p id="which" class="text-sm text-muted-foreground">{fullDateTime(trip.startTime)}</p>
				<p class="mt-1 text-3xl font-bold tracking-tight tabular-nums">
					{timeOnly(trip.startTime)} – {timeOnly(trip.endTime)}
				</p>
				<p class="mt-1 text-sm text-muted-foreground tabular-nums">
					{num(trip.distanceKm, 1)} km · {duration(trip.duration, 'short')}
					{#if Number.isFinite(trip.consumption)}· {num(trip.consumption, 1)} kWh/100 km{/if}
					·
					<a href={tripLink(trip.startTime)} class="underline underline-offset-4">details</a>
				</p>
			</div>

			<datalist id="label-places">
				{#each logbook.places as place (place)}
					<option value={place}></option>
				{/each}
			</datalist>

			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<Label for="label-from">From</Label>
					<Input
						id="label-from"
						list="label-places"
						placeholder="Where it started"
						class="h-11 text-base"
						bind:value={from}
					/>
					{#if origins[0] && from === origins[0].value}
						<p class="flex items-center gap-1 text-xs text-muted-foreground">
							<WandIcon class="size-3" />
							{origins[0].reason}
						</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<Label for="label-to">To</Label>
					<Input
						id="label-to"
						list="label-places"
						placeholder="Where it ended"
						class="h-11 text-base"
						bind:value={to}
						oninput={() => (toTouched = true)}
					/>
					{#if destinations[0] && to === destinations[0].value}
						<p class="flex items-center gap-1 text-xs text-muted-foreground">
							<WandIcon class="size-3" />
							{destinations[0].reason}
						</p>
					{/if}
				</div>
			</div>
			{#if destinations.length > 1}
				<div class="flex flex-wrap gap-1.5" aria-label="Other places">
					{#each destinations.slice(1) as option (option.value)}
						<button
							type="button"
							class="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
							onclick={() => {
								to = option.value;
								toTouched = true;
							}}
						>
							→ {option.value}
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<section aria-labelledby="purpose" class="space-y-3">
			<h2 id="purpose" class="text-sm font-medium text-muted-foreground">
				Pick a purpose to save and go to the next trip
			</h2>
			<div class="grid gap-2">
				{#each PURPOSES as option, index (option.value)}
					{@const color = PURPOSE_COLOR[option.value]}
					<button
						type="button"
						onclick={() => save(option.value)}
						class="flex min-h-14 items-center gap-3 rounded-2xl border-2 px-5 text-left text-lg font-semibold transition-colors"
						style="color: {color}; border-color: {suggested === option.value
							? color
							: 'var(--border)'}; background: {suggested === option.value
							? `color-mix(in oklab, ${color} 14%, transparent)`
							: 'var(--card)'}"
					>
						<span class="flex-1">{option.label}</span>
						{#if suggested === option.value}
							<span class="rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold">
								Suggested
							</span>
						{/if}
						<kbd
							class="hidden rounded border px-1.5 font-mono text-xs text-muted-foreground sm:inline"
						>
							{index + 1}
						</kbd>
					</button>
				{/each}
			</div>
			<div class="grid grid-cols-3 gap-2">
				<Button variant="ghost" size="lg" disabled={at === 0} onclick={back}>Back</Button>
				<Button variant="ghost" size="lg" onclick={skip}>Skip</Button>
				<Button
					variant="outline"
					size="lg"
					disabled={!from.trim() && !to.trim()}
					onclick={() => save('')}
				>
					Save, no purpose
				</Button>
			</div>
		</section>
	{/if}
</div>
