<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import TripDetail from '#lib/components/app/TripDetail.svelte';
	import TripNotes from '#lib/components/app/TripNotes.svelte';
	import ShareButton from '#lib/components/app/ShareButton.svelte';
	import BoardBanner from '#lib/components/app/BoardBanner.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { startFromParam, tripLink } from '#lib/data/range.js';
	import { logbook } from '#lib/state/logbook.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import ExportMenu from '#lib/components/app/ExportMenu.svelte';
	import PurposeChip, { PURPOSE_COLOR } from '#lib/components/app/PurposeChip.svelte';
	import { logbookDocument } from '#lib/logbook/document.js';
	import { confidentFills } from '#lib/logbook/bulk.js';
	import { PURPOSES } from '#lib/logbook/types.js';
	import { toast } from 'svelte-sonner';
	import {
		dateTime,
		duration,
		fullDay,
		maskVin,
		num,
		percent,
		shortDay,
		timeOnly
	} from '#lib/utils/format.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import MessageIcon from '@lucide/svelte/icons/message-square-text';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import WandIcon from '@lucide/svelte/icons/wand-sparkles';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';

	const stats = $derived(data.derived!);

	// A trip is named by when it started, which means the same in every range.
	const wanted = $derived(startFromParam(page.url.searchParams.get('trip')));
	const trip = $derived(
		wanted === null ? null : (stats.trips.find((other) => other.startTime === wanted) ?? null)
	);

	// A link to a trip outside the range on screen widens the view to reach it.
	// Only a link does: narrowing the range under an open trip goes back to the
	// list, rather than undoing the choice that was just made.
	let followed: number | null = null;
	$effect(() => {
		if (wanted === null || trip) {
			followed = wanted;
		} else if (followed === wanted) {
			void goto('/dash/trips', { replaceState: true });
		} else {
			followed = wanted;
			data.reveal('trip', wanted);
		}
	});

	type SortKey = 'startTime' | 'distanceKm' | 'duration' | 'maxSpeed' | 'consumption';
	let sortKey = $state<SortKey>('startTime');
	let ascending = $state(false);
	type Show = 'all' | 'unlabelled' | 'business' | 'commute' | 'private';
	const SHOWS: Show[] = ['all', 'unlabelled', 'business', 'commute', 'private'];
	// Kept in the address, so a link (Home's "Label trips") or a reload lands on the same list.
	const show = $derived.by<Show>(() => {
		const asked = page.url.searchParams.get('show') as Show | null;
		return asked && SHOWS.includes(asked) ? asked : 'all';
	});

	function setShow(next: Show) {
		const url = new URL(page.url.href);
		if (next === 'all') url.searchParams.delete('show');
		else url.searchParams.set('show', next);
		void goto(url, { replace: true, reset: false });
	}

	const notes = $derived(logbook.bound.byTrip);
	const unlabelled = $derived(stats.trips.length - logbook.labelled);
	// Somebody else's export has no logbook here: nothing to label, nothing to hand in.
	const shared = $derived(data.source.kind === 'shared');

	/** The next trip with nowhere written against it, after this one. */
	const nextUnlabelled = $derived.by(() => {
		if (!trip) return null;
		const after = stats.trips
			.filter((other) => other.startTime > trip.startTime)
			.sort((a, b) => a.startTime - b.startTime);
		const found = after.find((other) => {
			const note = notes.get(other.startTime);
			return !note?.origin && !note?.destination;
		});
		return found ?? null;
	});

	function route(startTime: number): string {
		const note = notes.get(startTime);
		if (!note?.origin && !note?.destination) return '';
		return [note?.origin || '?', note?.destination || '?'].join(' → ');
	}

	const vehicle = $derived(
		[
			data.dataset?.vmodel,
			settings.revealVin ? data.dataset?.vin : maskVin(data.dataset?.vin ?? '')
		]
			.filter(Boolean)
			.join(' · ')
	);

	const book = $derived(
		logbookDocument(stats.trips, notes, settings.timeZone, vehicle, settings.pricePerKwh)
	);

	function hasPlace(startTime: number): boolean {
		const note = notes.get(startTime);
		return Boolean(note?.origin || note?.destination);
	}

	function matches(startTime: number, which: Show): boolean {
		if (which === 'all') return true;
		if (which === 'unlabelled') return !hasPlace(startTime);
		return notes.get(startTime)?.purpose === which;
	}

	const filters = $derived(
		(
			[
				{ value: 'all', label: 'All' },
				{ value: 'unlabelled', label: 'No place yet' },
				...PURPOSES.map((option) => ({ value: option.value, label: option.label }))
			] as Array<{ value: Show; label: string }>
		).map((option) => ({
			...option,
			count: stats.trips.filter((row) => matches(row.startTime, option.value)).length
		}))
	);

	/** Trips the logbook's own habits settle beyond doubt, ready to fill in at once. */
	const fills = $derived(
		!shared && logbook.loaded && logbook.vin
			? confidentFills(stats.trips, notes, logbook.vin, settings.timeZone)
			: []
	);

	async function fillAll() {
		const batch = fills;
		try {
			await logbook.saveMany(batch.map((fill) => fill.after));
		} catch {
			toast.error('Those notes could not be saved in this browser.');
			return;
		}
		toast(`Filled in ${batch.length} ${batch.length === 1 ? 'trip' : 'trips'}`, {
			description: 'Each one can still be changed on its own.',
			action: {
				label: 'Undo',
				// Only trips still as the fill left them: a correction made since is kept.
				onClick: () => {
					const untouched = batch.filter((fill) => {
						const now = logbook.bound.byTrip.get(fill.trip.startTime);
						return (
							now?.origin === fill.after.origin &&
							now?.destination === fill.after.destination &&
							now?.purpose === fill.after.purpose
						);
					});
					logbook
						.saveMany(untouched.map((fill) => fill.before))
						.catch(() => toast.error('The fill could not be undone in this browser.'));
				}
			}
		});
	}

	/**
	 * The trips either side of this one in the list on screen, so J/K and the
	 * arrows walk the same list the side panel shows. A trip the filter hides
	 * walks the whole record in time order instead.
	 */
	const neighbours = $derived.by(() => {
		if (!trip) return { previous: null, next: null };
		const inList = sorted.findIndex((other) => other.startTime === trip.startTime);
		const ordered =
			inList >= 0 ? sorted : [...stats.trips].sort((a, b) => b.startTime - a.startTime);
		const at = inList >= 0 ? inList : ordered.findIndex((o) => o.startTime === trip.startTime);
		return { previous: ordered[at - 1] ?? null, next: ordered[at + 1] ?? null };
	});

	/** A trip's address, keeping whatever filter the list is on. */
	function linkTo(startTime: number): string {
		const link = tripLink(startTime);
		return show === 'all' ? link : `${link}&show=${show}`;
	}

	const listLink = $derived(show === 'all' ? '/dash/trips' : `/dash/trips?show=${show}`);

	/** Trips still missing a place that the range on screen leaves out. */
	const outOfRange = $derived(
		show === 'unlabelled' && data.range
			? Math.max(
					0,
					logbook.record.unlabelled - (filters.find((f) => f.value === 'unlabelled')?.count ?? 0)
				)
			: 0
	);

	let rail = $state<HTMLElement>();
	// Keep the open trip in view in the side panel as J/K walk the list.
	$effect(() => {
		const current = trip?.startTime;
		if (!rail || current === undefined) return;
		rail.querySelector(`[data-trip="${current}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	function step(event: KeyboardEvent) {
		if (!trip || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable]')) return;
		const to = event.key === 'j' ? neighbours.next : event.key === 'k' ? neighbours.previous : null;
		if (to) {
			event.preventDefault();
			void goto(linkTo(to.startTime));
		}
	}

	const sorted = $derived.by(() => {
		const list = stats.trips.filter((row) => matches(row.startTime, show));
		list.sort((a, b) => {
			const left = a[sortKey];
			const right = b[sortKey];
			// Trips missing a value sort last whichever way the column is ordered.
			if (Number.isNaN(left)) return 1;
			if (Number.isNaN(right)) return -1;
			return ascending ? left - right : right - left;
		});
		return list;
	});

	function sortBy(key: SortKey) {
		if (sortKey === key) ascending = !ascending;
		else {
			sortKey = key;
			ascending = key === 'startTime' ? false : false;
		}
	}

	const columns: Array<{ key: SortKey; label: string; align?: string }> = [
		{ key: 'startTime', label: 'Started' },
		{ key: 'distanceKm', label: 'Distance', align: 'text-right' },
		{ key: 'duration', label: 'Duration', align: 'text-right' },
		{ key: 'maxSpeed', label: 'Top speed', align: 'text-right' },
		{ key: 'consumption', label: 'kWh/100 km', align: 'text-right' }
	];
</script>

<svelte:window onkeydown={step} />

{#snippet chips(compact = false)}
	<div class="flex flex-wrap gap-2" role="group" aria-label="Show trips">
		{#each filters as option (option.value)}
			<button
				type="button"
				aria-pressed={show === option.value}
				onclick={() => setShow(option.value)}
				class="inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground {compact
					? 'h-8 px-3 text-xs'
					: 'h-9 px-3.5 text-sm'}"
			>
				{#if option.value in PURPOSE_COLOR}
					<span
						class="size-2 rounded-full"
						style="background: {PURPOSE_COLOR[option.value as keyof typeof PURPOSE_COLOR]}"
					></span>
				{/if}
				{option.label}
				<span class="tabular-nums opacity-60">{option.count}</span>
			</button>
		{/each}
	</div>
{/snippet}

{#if trip}
	<!-- Wide screens keep the list beside the trip; narrower ones switch between them. -->
	<div
		class="mx-auto max-w-[90rem] xl:grid xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start xl:gap-8"
	>
		<aside
			aria-label="Trips"
			class="sticky top-32 hidden max-h-[calc(100svh-10rem)] flex-col overflow-hidden rounded-2xl border bg-card xl:flex"
		>
			<div class="space-y-3 border-b p-4">
				<div class="flex items-center justify-between gap-2">
					<a href={listLink} class="font-semibold hover:underline">
						{sorted.length}
						{sorted.length === 1 ? 'trip' : 'trips'}
					</a>
					{#if unlabelled > 0 && !shared}
						<a href="/dash/trips/label" class="text-xs text-muted-foreground hover:text-foreground">
							Label one by one
						</a>
					{/if}
				</div>
				{#if !shared}{@render chips(true)}{/if}
			</div>
			<ol bind:this={rail} class="flex-1 overflow-y-auto pb-1">
				{#each sorted as row, i (row.index)}
					{@const purpose = notes.get(row.startTime)?.purpose}
					{@const current = row.startTime === trip.startTime}
					{@const day = shortDay(row.startTime)}
					{#if sortKey === 'startTime' && (i === 0 || shortDay(sorted[i - 1].startTime) !== day)}
						<li class="sticky top-0 z-10 border-b bg-card px-4 pt-3 pb-1.5 eyebrow">{day}</li>
					{/if}
					<li data-trip={row.startTime} class="border-b last:border-b-0">
						<a
							href={linkTo(row.startTime)}
							aria-current={current ? 'page' : undefined}
							class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50 aria-[current=page]:bg-[color-mix(in_oklab,var(--viz-1)_14%,transparent)] aria-[current=page]:shadow-[inset_3px_0_0_var(--viz-1)]"
						>
							<span class="w-11 shrink-0 text-sm text-muted-foreground tabular-nums">
								{sortKey === 'startTime' ? timeOnly(row.startTime) : shortDay(row.startTime)}
							</span>
							<span class="flex min-w-0 flex-1 flex-col">
								<span
									class="truncate text-sm font-medium {route(row.startTime)
										? ''
										: 'text-muted-foreground'}"
								>
									{route(row.startTime) || 'No place yet'}
								</span>
								<span class="text-xs text-muted-foreground tabular-nums">
									{num(row.distanceKm, 1)} km · {duration(row.duration, 'short')}
								</span>
							</span>
							{#if purpose || !shared}<PurposeChip {purpose} />{/if}
						</a>
					</li>
				{/each}
			</ol>
		</aside>

		<div class="min-w-0 space-y-6">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" href={listLink} class="xl:hidden">
					<ArrowLeftIcon class="size-4" />
					All trips
				</Button>
				<div class="min-w-0">
					<p class="text-sm text-muted-foreground">{fullDay(trip.startTime)}</p>
					<p class="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
						{timeOnly(trip.startTime)} – {timeOnly(trip.endTime)}
					</p>
				</div>
				<div class="ml-auto flex items-center gap-1">
					<span class="mr-2 hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
						<kbd class="rounded border border-b-2 px-1.5 font-mono">J</kbd>
						<kbd class="rounded border border-b-2 px-1.5 font-mono">K</kbd>
						next / previous
					</span>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Previous trip in the list"
						disabled={!neighbours.previous}
						onclick={() => neighbours.previous && goto(linkTo(neighbours.previous.startTime))}
					>
						<ChevronLeftIcon class="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Next trip in the list"
						disabled={!neighbours.next}
						onclick={() => neighbours.next && goto(linkTo(neighbours.next.startTime))}
					>
						<ChevronRightIcon class="size-4" />
					</Button>
					<ShareButton
						kind="trip"
						startTime={trip.startTime}
						endTime={trip.endTime}
						meta={{
							distanceKm: trip.distanceKm,
							duration: trip.duration,
							movingSeconds: trip.movingSeconds,
							maxSpeed: trip.maxSpeed,
							avgSpeed: trip.avgSpeed,
							energyKwh: trip.energyKwh - trip.regenKwh,
							regenShare: trip.regenShare,
							socStart: trip.socStart,
							socEnd: trip.socEnd
						}}
					/>
				</div>
			</div>

			<BoardBanner startTime={trip.startTime} />

			<TripNotes {trip} />

			{#if nextUnlabelled && !shared}
				<div class="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onclick={() => goto(linkTo(nextUnlabelled.startTime))}
					>
						Next unlabelled trip
						<ArrowRightIcon class="size-4" />
					</Button>
				</div>
			{/if}

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card.Root>
					<Card.Content>
						<BigStat
							kicker="Distance"
							value={num(trip.distanceKm, 1)}
							unit="km"
							size="sm"
							accent="--viz-1"
						/>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content>
						<BigStat
							kicker="Duration"
							value={duration(trip.duration, 'short')}
							size="sm"
							accent="--viz-3"
							detail="{duration(trip.movingSeconds, 'short')} actually moving"
						/>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content>
						<BigStat
							kicker="Top speed"
							value={num(trip.maxSpeed)}
							unit="km/h"
							size="sm"
							accent="--viz-2"
							detail="Average {num(trip.avgSpeed)} km/h while moving"
						/>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content>
						<BigStat
							kicker="Energy used"
							value={num(trip.energyKwh - trip.regenKwh, 1)}
							unit="kWh"
							size="sm"
							accent="--viz-4"
							detail={Number.isFinite(trip.regenShare)
								? `${percent(trip.regenShare)} came back through regeneration`
								: undefined}
						/>
					</Card.Content>
				</Card.Root>
			</div>

			<Card.Root>
				<Card.Header>
					<Card.Title>Second by second</Card.Title>
					<Card.Description>
						Drag across any panel to zoom; the cursor is shared between them.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<TripDetail
						source={data.dataset!}
						from={trip.start}
						to={trip.end}
						syncKey={`trip-${trip.index}`}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Forces</Card.Title>
				</Card.Header>
				<Card.Content class="grid gap-6 sm:grid-cols-3">
					<BigStat
						kicker="Hardest acceleration"
						value={num(trip.peakAccel, 2)}
						unit="g"
						size="sm"
						accent="--viz-3"
					/>
					<BigStat
						kicker="Hardest braking"
						value={num(trip.peakBrake, 2)}
						unit="g"
						size="sm"
						accent="--viz-8"
					/>
					<BigStat
						kicker="Hardest cornering"
						value={num(trip.peakLateral, 2)}
						unit="g"
						size="sm"
						accent="--viz-7"
					/>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-6xl space-y-6">
		<div class="grid grid-cols-3 gap-3 sm:gap-4">
			<Card.Root>
				<Card.Content>
					<BigStat kicker="Trips" value={num(stats.trips.length)} size="sm" accent="--viz-1" />
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Longest"
						value={num(Math.max(...stats.trips.map((t) => t.distanceKm)), 0)}
						unit="km"
						size="sm"
						accent="--viz-3"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Median trip"
						value={num(
							[...stats.trips.map((t) => t.distanceKm)].sort((a, b) => a - b)[
								Math.floor(stats.trips.length / 2)
							] ?? NaN,
							1
						)}
						unit="km"
						size="sm"
						accent="--viz-4"
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<Card.Title>Every trip</Card.Title>
						<Card.Description>
							Segmented from gear and odometer movement. Select one to see it in detail, and to say
							where it went.
						</Card.Description>
					</div>
					<div class="flex items-center gap-2">
						{#if !shared}
							<ExportMenu
								kind="fahrtenbuch"
								variant="ghost"
								title={book.title}
								subtitle={book.subtitle}
								columns={book.columns}
								rows={book.rows}
								totals={book.totals}
								notes={book.notes}
								timeZone={settings.timeZone}
								from={book.from}
								to={book.to}
							/>
						{/if}
					</div>
				</div>
				{#if !shared}
					<div class="flex flex-wrap items-center gap-2 pt-2">
						{@render chips()}
						{#if unlabelled > 0}
							<Button href="/dash/trips/label" variant="ghost" size="sm" class="ml-auto">
								<ListChecksIcon class="size-4" />
								Label one by one
							</Button>
						{/if}
					</div>
				{/if}
				{#if outOfRange > 0}
					<div class="mt-2 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-4">
						<p class="min-w-60 flex-1 text-sm">
							{outOfRange === 1 ? 'One more trip' : `${outOfRange} more trips`} without a place
							{outOfRange === 1 ? 'is' : 'are'} outside {data.range?.label.toLowerCase()}.
						</p>
						<Button variant="outline" size="sm" onclick={() => data.setRange(null)}>
							Show the whole record
						</Button>
					</div>
				{/if}
				{#if fills.length > 0 && unlabelled > 0}
					<div
						class="mt-2 flex flex-wrap items-center gap-3 rounded-xl border p-4"
						style="border-color: color-mix(in oklab, var(--viz-2) 35%, transparent); background: color-mix(in oklab, var(--viz-2) 8%, transparent)"
					>
						<WandIcon class="size-5 shrink-0" style="color: var(--viz-2)" />
						<p class="min-w-60 flex-1 text-sm">
							<span class="font-semibold">
								{fills.length === 1 ? 'One trip matches' : `${fills.length} trips match`} your habits.
							</span>
							Same start, same distance, same time of day as trips you already filled in.
						</p>
						<Button variant="outline" size="sm" onclick={fillAll}>
							Fill {fills.length === 1 ? 'it' : `all ${fills.length}`} in
						</Button>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-end gap-2 sm:hidden">
					<label for="sort" class="text-sm text-muted-foreground">Sort by</label>
					<select
						id="sort"
						class="h-9 rounded-lg border bg-background px-2 text-sm"
						value="{sortKey}:{ascending ? 'up' : 'down'}"
						onchange={(event) => {
							const [key, way] = event.currentTarget.value.split(':');
							sortKey = key as SortKey;
							ascending = way === 'up';
						}}
					>
						<option value="startTime:down">Newest first</option>
						<option value="startTime:up">Oldest first</option>
						<option value="distanceKm:down">Longest first</option>
						<option value="consumption:up">Most efficient first</option>
					</select>
				</div>
				<ul class="-mx-5 mt-3 divide-y border-t sm:hidden" aria-label="Trips">
					{#each sorted as row (row.index)}
						{@const purpose = notes.get(row.startTime)?.purpose}
						<li>
							<a
								href={linkTo(row.startTime)}
								class="flex items-center gap-3 px-5 py-3 active:bg-accent/40"
							>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="truncate {route(row.startTime) ? '' : 'text-muted-foreground'}">
										{route(row.startTime) || 'No place yet'}
									</span>
									<span class="text-xs text-muted-foreground tabular-nums">
										{dateTime(row.startTime)} · {duration(row.duration, 'short')}
									</span>
								</span>
								<span class="flex flex-col items-end gap-1">
									<span class="text-sm font-semibold tabular-nums">{num(row.distanceKm, 1)} km</span
									>
									{#if purpose || !shared}<PurposeChip {purpose} />{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
				<div class="hidden overflow-x-auto sm:block">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								{#each columns as column (column.key)}
									<Table.Head class={column.align}>
										<button
											type="button"
											class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
											onclick={() => sortBy(column.key)}
										>
											{column.label}
											<ArrowUpDownIcon class="size-3 opacity-50" />
										</button>
									</Table.Head>
								{/each}
								<Table.Head>Route</Table.Head>
								<Table.Head>Purpose</Table.Head>
								<Table.Head class="text-right">Charge</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each sorted as row (row.index)}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50"
									onclick={() => goto(linkTo(row.startTime))}
								>
									<Table.Cell class="font-medium">{dateTime(row.startTime)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{num(row.distanceKm, 1)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{duration(row.duration, 'short')}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{num(row.maxSpeed)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{Number.isFinite(row.consumption) ? num(row.consumption, 1) : '—'}
									</Table.Cell>
									<Table.Cell class="max-w-56">
										{#if route(row.startTime)}
											<span class="flex items-center gap-1.5">
												<span class="truncate">{route(row.startTime)}</span>
												{#if notes.get(row.startTime)?.comment}
													<MessageIcon class="size-3.5 shrink-0 text-muted-foreground" />
												{/if}
											</span>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{@const purpose = notes.get(row.startTime)?.purpose}
										{#if purpose || !shared}
											<PurposeChip {purpose} />
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-right">
										{#if Number.isFinite(row.socStart)}
											<Badge variant="secondary" class="tabular-nums">
												{num(row.socStart)}% → {num(row.socEnd)}%
											</Badge>
										{:else}
											—
										{/if}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
