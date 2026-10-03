<!--
  Home: what needs you, then what happened.

  The top row is only ever things the reader can act on — trips still missing
  a place, the export window about to close, the boards — so the page answers
  "is there anything to do?" before "what did the car do?". Then the
  highlights, the headline figures, the month at a glance, and the latest of
  everything, each a way into its own page.
-->
<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import DailyBars from '#lib/components/charts/DailyBars.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { logbook } from '#lib/state/logbook.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { EXPORT_WINDOW_DAYS, sessionLink, tripLink } from '#lib/data/range.js';
	import PurposeChip from '#lib/components/app/PurposeChip.svelte';
	import { PURPOSES } from '#lib/logbook/types.js';
	import {
		dateOnly,
		duration,
		num,
		percent,
		prettyDay,
		shortDay,
		timeOnly
	} from '#lib/utils/format.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import PlayIcon from '@lucide/svelte/icons/play';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);
	const whole = $derived(data.full?.derived ?? stats);
	const shared = $derived(data.source.kind === 'shared');

	const totalKm = $derived(stats.days.reduce((sum, day) => sum + day.distanceKm, 0));
	const drivingSeconds = $derived(stats.trips.reduce((sum, trip) => sum + trip.movingSeconds, 0));
	// Measured against the time the exports actually account for, not the
	// calendar span: a merged record has holes that were never recorded.
	const coverage = $derived(dataset.time.length / stats.recordedSeconds);
	const consumption = $derived(totalKm > 0 ? (stats.charging.totalKwh / totalKm) * 100 : NaN);
	const cost = $derived(stats.charging.totalKwh * settings.pricePerKwh);

	const calendar = $derived(
		stats.days.map((day) => ({ date: day.date, value: day.distanceKm, covered: day.covered }))
	);

	const busiest = $derived(
		stats.days.reduce<(typeof stats.days)[number] | null>(
			(best, day) => (!best || day.distanceKm > best.distanceKm ? day : best),
			null
		)
	);

	let selectedDay = $state<string | null>(null);
	const dayDetail = $derived(stats.days.find((day) => day.date === selectedDay) ?? null);

	// What needs the reader.
	const notes = $derived(logbook.bound.byTrip);
	const unlabelled = $derived(!shared && logbook.loaded ? logbook.record.unlabelled : 0);
	const requestBy = $derived(whole.endTime + EXPORT_WINDOW_DAYS * 86_400);
	const lapsed = $derived(requestBy * 1000 < Date.now());
	const longest = $derived(
		stats.trips.reduce<(typeof stats.trips)[number] | null>(
			(best, trip) => (!best || trip.distanceKm > best.distanceKm ? trip : best),
			null
		)
	);

	// The highlights, about the whole record whatever the range.
	const highlight = $derived(
		whole.facts.headline.find((fact) => /longest/i.test(fact.kicker)) ?? whole.facts.headline[0]
	);
	const moments = $derived(
		whole.facts.headline.length + whole.facts.habit.length + Math.min(3, whole.facts.quirk.length)
	);

	const latestTrips = $derived(
		[...stats.trips].sort((a, b) => b.startTime - a.startTime).slice(0, 5)
	);
	const latestCharges = $derived(
		[...stats.charging.sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 4)
	);

	function route(startTime: number): string {
		const note = notes.get(startTime);
		if (!note?.origin && !note?.destination) return '';
		return `${note?.origin || '?'} → ${note?.destination || '?'}`;
	}

	function purposeOf(startTime: number) {
		const value = notes.get(startTime)?.purpose;
		return PURPOSES.find((option) => option.value === value) ?? null;
	}
</script>

<div class="mx-auto max-w-6xl space-y-10">
	{#if unlabelled > 0 || !shared}
		<section aria-labelledby="attention" class="space-y-3">
			<h2 id="attention" class="eyebrow">Worth your attention</h2>
			<div class="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
				{#if unlabelled > 0}
					<Card.Root
						class="border-[color-mix(in_oklab,var(--viz-2)_35%,transparent)]"
						style="background: radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--viz-2) 16%, transparent), transparent 60%), var(--card)"
					>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--viz-2)">
								Logbook {percent(
									(logbook.record.trips - unlabelled) / Math.max(1, logbook.record.trips)
								)} complete
							</p>
							<p class="text-lg font-semibold">
								{unlabelled === 1 ? 'One trip has' : `${num(unlabelled)} trips have`} no place yet
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								Suggestions come from the trips you have already filled in.
							</p>
							<a
								href="/dash/trips/label"
								class="{buttonVariants({ size: 'lg' })} mt-auto self-start"
							>
								Label trips
							</a>
						</Card.Content>
					</Card.Root>
				{/if}
				{#if !shared && !data.isDemo}
					<Card.Root>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--muted-foreground)">Keep it unbroken</p>
							<p class="text-lg font-semibold">
								{lapsed
									? `Your record stops on ${dateOnly(whole.endTime)}`
									: `Request the next export by ${dateOnly(requestBy)}`}
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								XPeng keeps only thirty days. Drop the new files in and they join on.
							</p>
							<div class="mt-auto flex flex-wrap gap-2">
								<a
									href="https://www.xpeng.com/data-act"
									target="_blank"
									rel="noreferrer noopener"
									class={buttonVariants({ variant: 'outline', size: 'lg' })}
								>
									Request at XPeng
									<ArrowUpRightIcon class="size-4" />
								</a>
								<a href="/dash/data" class={buttonVariants({ variant: 'ghost', size: 'lg' })}
									>Add data</a
								>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
				{#if !shared && longest}
					<Card.Root>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--viz-4)">Monthly leaderboard</p>
							<p class="text-lg font-semibold">
								Your longest drive: {num(longest.distanceKm)} km
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								See how it stands. Nothing is listed unless you put your name to it.
							</p>
							<a
								href="/leaderboard"
								class="{buttonVariants({ variant: 'outline', size: 'lg' })} mt-auto self-start"
							>
								See the boards
							</a>
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</section>
	{/if}

	{#if highlight}
		<a
			href="/wrapped"
			class="group flex flex-wrap items-center gap-6 rounded-2xl border p-6 transition-colors hover:border-foreground/20 sm:p-8"
			style="background: radial-gradient(90% 160% at 85% 50%, color-mix(in oklab, var(--viz-4) 18%, transparent), transparent 60%), var(--card)"
		>
			<span class="min-w-64 flex-1 space-y-1.5">
				<span class="block eyebrow">The highlights, in {moments} moments</span>
				<span class="block text-2xl font-bold tracking-tight">
					The things you would not have thought to ask
				</span>
				<span class="block text-sm text-muted-foreground"
					>{highlight.kicker}: {highlight.detail}</span
				>
			</span>
			<span class="flex items-baseline gap-2">
				<span
					class="text-6xl font-bold tracking-tighter tabular-nums sm:text-7xl"
					style="color: var(--viz-4)">{highlight.value}</span
				>
				{#if highlight.unit}
					<span class="text-xl font-semibold text-muted-foreground">{highlight.unit}</span>
				{/if}
			</span>
			<span class={buttonVariants({ size: 'lg' })}>
				<PlayIcon class="size-4" />
				Play
			</span>
		</a>
	{/if}

	<section
		aria-label="At a glance"
		class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-5"
	>
		{#each [{ kicker: 'Distance', value: num(totalKm), unit: 'km', accent: '--viz-1', detail: `${num(stats.trips.length)} trips over ${stats.recordedDays} days` }, { kicker: 'Time driving', value: duration(drivingSeconds, 'short'), unit: '', accent: '--viz-3', detail: `${percent(drivingSeconds / stats.recordedSeconds, 1)} of the time recorded` }, { kicker: 'Energy charged', value: num(stats.charging.totalKwh), unit: 'kWh', accent: '--viz-4', detail: `${stats.charging.sessions.length} sessions` }, { kicker: 'Charging cost', value: settings.formatCurrency(cost), unit: '', accent: '--viz-5', detail: `At ${settings.formatCurrency(settings.pricePerKwh)} per kWh, set under Data` }, { kicker: 'Consumption', value: Number.isFinite(consumption) ? num(consumption, 1) : '—', unit: 'kWh/100 km', accent: '--viz-7', detail: `Odometer now ${num(stats.odometerEnd)} km` }] as stat (stat.kicker)}
			<div class="bg-card p-5 last:col-span-2 sm:p-6 lg:last:col-span-1">
				<BigStat
					kicker={stat.kicker}
					value={stat.value}
					unit={stat.unit || undefined}
					size="sm"
					accent={stat.accent}
					detail={stat.detail}
				/>
			</div>
		{/each}
	</section>

	<Card.Root>
		<Card.Header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
			<div class="space-y-1.5">
				<Card.Title class="text-lg">Distance per day</Card.Title>
				<Card.Description>
					Select a day to see what happened. Dashed line: your daily average.
				</Card.Description>
			</div>
			{#if busiest && busiest.distanceKm > 0}
				<p class="text-sm text-muted-foreground tabular-nums">
					Busiest: <span class="font-medium text-foreground"
						>{prettyDay(busiest.date)}, {num(busiest.distanceKm)} km</span
					>
				</p>
			{/if}
		</Card.Header>
		<Card.Content>
			<DailyBars
				days={calendar}
				selected={selectedDay}
				onSelect={(date) => (selectedDay = selectedDay === date ? null : date)}
			/>

			{#if dayDetail}
				<div class="mt-4 rounded-lg border bg-muted/40 p-4">
					<p class="font-medium">{prettyDay(dayDetail.date)}</p>
					<dl
						class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4"
					>
						<div>
							<dt class="inline">Distance</dt>
							<dd class="inline text-foreground tabular-nums">
								{num(dayDetail.distanceKm, 1)} km
							</dd>
						</div>
						<div>
							<dt class="inline">Trips</dt>
							<dd class="inline text-foreground tabular-nums">{dayDetail.trips}</dd>
						</div>
						<div>
							<dt class="inline">Driving</dt>
							<dd class="inline text-foreground tabular-nums">
								{duration(dayDetail.drivingSeconds, 'short')}
							</dd>
						</div>
						<div>
							<dt class="inline">Charged</dt>
							<dd class="inline text-foreground tabular-nums">
								{num(dayDetail.chargedKwh, 1)} kWh
							</dd>
						</div>
					</dl>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
		<Card.Root class="gap-0 py-0">
			<div class="flex items-center justify-between px-6 py-5">
				<h2 class="text-lg font-semibold">Latest trips</h2>
				<a href="/dash/trips" class="text-sm text-primary-link">
					All {num(stats.trips.length)} trips
				</a>
			</div>
			<ul>
				{#each latestTrips as trip (trip.startTime)}
					{@const purpose = purposeOf(trip.startTime)}
					<li class="border-t">
						<a
							href={tripLink(trip.startTime)}
							class="flex min-h-16 items-center gap-4 px-6 py-3 transition-colors hover:bg-accent/40"
						>
							<span class="flex w-24 shrink-0 flex-col tabular-nums">
								<span class="text-sm font-medium">{shortDay(trip.startTime)}</span>
								<span class="text-xs text-muted-foreground">{timeOnly(trip.startTime)}</span>
							</span>
							<span
								class="min-w-0 flex-1 truncate {route(trip.startTime)
									? ''
									: 'text-muted-foreground'}"
							>
								{route(trip.startTime) || 'No place yet'}
							</span>
							<span class="text-sm tabular-nums">{num(trip.distanceKm, 1)} km</span>
							<span class="hidden w-24 justify-end sm:flex">
								{#if purpose || !shared}
									<PurposeChip purpose={purpose?.value} />
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</Card.Root>

		<Card.Root class="gap-0 py-0">
			<div class="flex items-center justify-between px-6 py-5">
				<h2 class="text-lg font-semibold">Latest charging</h2>
				<a href="/dash/charging" class="text-sm text-primary-link">
					All {num(stats.charging.sessions.length)} sessions
				</a>
			</div>
			<ul>
				{#each latestCharges as session (session.startTime)}
					<li class="border-t">
						<a
							href={sessionLink(session.startTime)}
							class="flex min-h-15 items-center gap-4 px-6 py-3 transition-colors hover:bg-accent/40"
						>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-sm font-medium tabular-nums"
									>{shortDay(session.startTime)}, {timeOnly(session.startTime)}</span
								>
								<span class="text-xs text-muted-foreground">
									{session.isDc ? 'DC fast' : 'AC'} · {duration(session.duration, 'short')}
								</span>
							</span>
							<span class="flex flex-col items-end">
								<span class="text-sm tabular-nums">{num(session.kwhDelivered, 1)} kWh</span>
								<span class="text-xs text-muted-foreground tabular-nums">
									{num(session.socStart)}% → {num(session.socEnd)}%
								</span>
							</span>
						</a>
					</li>
				{:else}
					<li class="border-t px-6 py-5 text-sm text-muted-foreground">
						No charging in this range.
					</li>
				{/each}
			</ul>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg">What the recording covers</Card.Title>
			<Card.Description>
				The car logs once a second, but only while it is awake.
				{#if stats.sources > 1}
					These {stats.sources} exports cover {stats.recordedDays} days between them.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-6 sm:grid-cols-3">
			<BigStat
				kicker="Samples recorded"
				value={num(dataset.time.length)}
				size="sm"
				accent="--viz-3"
				detail="{percent(coverage)} of every second the exports cover"
			/>
			<BigStat
				kicker="Longest silence"
				value={duration(stats.drain.longestSleepHours * 3600, 'short')}
				size="sm"
				accent="--viz-5"
				detail="The longest the car went without writing anything"
			/>
			<BigStat
				kicker="Signals reported"
				value={num([...dataset.columns.values()].filter((column) => column.nonNull > 0).length)}
				size="sm"
				accent="--viz-7"
				detail="{dataset.emptyColumns.length} more exist in the file but were never filled"
			/>
		</Card.Content>
	</Card.Root>
</div>
