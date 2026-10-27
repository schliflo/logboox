<!--
  Home: what needs you, then what happened.

  The top row is only ever things the reader can act on — trips still missing
  a place, the export window about to close, the boards — so the page answers
  "is there anything to do?" before "what did the car do?". Then the
  highlights, the headline figures, the month at a glance, and the latest of
  everything, each a way into its own page.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
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
		distance,
		duration,
		num,
		percent,
		prettyDay,
		shortDay,
		timeOnly,
		toConsumption,
		toDistance,
		units
	} from '#lib/utils/format.js';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { factText } from '#lib/i18n/facts.js';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);
	const whole = $derived(data.full?.derived ?? stats);
	const shared = $derived(data.source.kind === 'shared');

	const totalKm = $derived(stats.days.reduce((sum, day) => sum + day.distanceKm, 0));
	const drivingSeconds = $derived(stats.trips.reduce((sum, trip) => sum + trip.movingSeconds, 0));
	// Measured against the time the exports actually account for, not the
	// calendar span: a merged record has holes that were never recorded.
	const coverage = $derived(dataset.time.length / stats.recordedSeconds);
	const kwhPer100km = $derived(totalKm > 0 ? (stats.charging.totalKwh / totalKm) * 100 : NaN);
	const cost = $derived(stats.charging.totalKwh * settings.pricePerKwh);

	const calendar = $derived(
		stats.days.map((day) => ({
			date: day.date,
			value: toDistance(day.distanceKm),
			covered: day.covered
		}))
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
		whole.facts.headline.find((fact) => fact.id === 'longest-trip') ?? whole.facts.headline[0]
	);
	const highlightText = $derived(highlight ? factText(highlight) : null);
	const moments = $derived(
		whole.facts.headline.length + whole.facts.habit.length + Math.min(3, whole.facts.quirk.length)
	);

	const latestTrips = $derived(
		[...stats.trips].sort((a, b) => b.startTime - a.startTime).slice(0, 5)
	);
	const latestCharges = $derived(
		[...stats.charging.sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 4)
	);

	const glance = $derived([
		{
			kicker: m.overview.distance,
			value: num(toDistance(totalKm)),
			unit: units().distance,
			accent: '--viz-1',
			detail: m.overview.tripsOver(num(stats.trips.length), stats.recordedDays)
		},
		{
			kicker: m.overview.timeDriving,
			value: duration(drivingSeconds, 'short'),
			unit: '',
			accent: '--viz-3',
			detail: m.overview.ofRecorded(percent(drivingSeconds / stats.recordedSeconds, 1))
		},
		{
			kicker: m.overview.energyCharged,
			value: num(stats.charging.totalKwh),
			unit: 'kWh',
			accent: '--viz-4',
			detail: m.overview.sessions(stats.charging.sessions.length)
		},
		{
			kicker: m.overview.chargingCost,
			value: settings.formatCurrency(cost),
			unit: '',
			accent: '--viz-5',
			detail: m.overview.atPrice(settings.formatCurrency(settings.pricePerKwh))
		},
		{
			kicker: m.overview.consumption,
			value: Number.isFinite(kwhPer100km) ? num(toConsumption(kwhPer100km), 1) : '—',
			unit: units().consumption,
			accent: '--viz-7',
			detail: m.overview.odometerNow(distance(stats.odometerEnd))
		}
	]);

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
			<h2 id="attention" class="eyebrow">{m.overview.attention}</h2>
			<div class="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
				{#if unlabelled > 0}
					<Card.Root
						class="border-[color-mix(in_oklab,var(--viz-2)_35%,transparent)]"
						style="background: radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--viz-2) 16%, transparent), transparent 60%), var(--card)"
					>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--viz-2)">
								{m.overview.logbookComplete(
									percent((logbook.record.trips - unlabelled) / Math.max(1, logbook.record.trips))
								)}
							</p>
							<p class="text-lg font-semibold">
								{m.overview.noPlaceYet(unlabelled, num(unlabelled))}
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								{m.overview.suggestionsFrom}
							</p>
							<a
								href="/dash/trips/label"
								class="{buttonVariants({ size: 'lg' })} mt-auto self-start"
							>
								{m.overview.labelTrips}
							</a>
						</Card.Content>
					</Card.Root>
				{/if}
				{#if !shared && !data.isDemo}
					<Card.Root>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--muted-foreground)">{m.overview.keepUnbroken}</p>
							<p class="text-lg font-semibold">
								{lapsed
									? m.overview.recordStops(dateOnly(whole.endTime))
									: m.overview.requestBy(dateOnly(requestBy))}
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								{m.overview.thirtyDays}
							</p>
							<div class="mt-auto flex flex-wrap gap-2">
								<a
									href="https://www.xpeng.com/data-act"
									target="_blank"
									rel="noreferrer noopener"
									class={buttonVariants({ variant: 'outline', size: 'lg' })}
								>
									{m.overview.requestAtXpeng}
									<ArrowUpRightIcon class="size-4" />
								</a>
								<a href="/dash/data" class={buttonVariants({ variant: 'ghost', size: 'lg' })}
									>{m.overview.addData}</a
								>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
				{#if !shared && longest}
					<Card.Root>
						<Card.Content class="flex h-full flex-col gap-2.5">
							<p class="chip" style="--chip: var(--viz-4)">{m.overview.monthly}</p>
							<p class="text-lg font-semibold">
								{m.overview.longestDrive(distance(longest.distanceKm))}
							</p>
							<p class="text-sm text-muted-foreground max-sm:hidden">
								{m.overview.seeStands}
							</p>
							<a
								href="/leaderboard"
								class="{buttonVariants({ variant: 'outline', size: 'lg' })} mt-auto self-start"
							>
								{m.overview.seeBoards}
							</a>
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</section>
	{/if}

	{#if highlight && highlightText}
		<a
			href="/wrapped"
			class="group flex flex-wrap items-center gap-6 rounded-2xl border p-6 transition-colors hover:border-foreground/20 sm:p-8"
			style="background: radial-gradient(90% 160% at 85% 50%, color-mix(in oklab, var(--viz-4) 18%, transparent), transparent 60%), var(--card)"
		>
			<span class="min-w-64 flex-1 space-y-1.5">
				<span class="block eyebrow">{m.overview.highlightsIn(moments)}</span>
				<span class="block text-2xl font-bold tracking-tight">
					{m.overview.wouldNotAsk}
				</span>
				<span class="block text-sm text-muted-foreground"
					>{highlightText.kicker}: {highlightText.detail}</span
				>
			</span>
			<span class="flex items-baseline gap-2">
				<span
					class="text-6xl font-bold tracking-tighter tabular-nums sm:text-7xl"
					style="color: var(--viz-4)">{highlightText.value}</span
				>
				{#if highlightText.unit}
					<span class="text-xl font-semibold text-muted-foreground">{highlightText.unit}</span>
				{/if}
			</span>
			<span class={buttonVariants({ size: 'lg' })}>
				<PlayIcon class="size-4" />
				{m.overview.play}
			</span>
		</a>
	{/if}

	<section
		aria-label={m.overview.atAGlance}
		class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-5"
	>
		{#each glance as stat (stat.accent)}
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
				<Card.Title class="text-lg">{m.overview.perDay}</Card.Title>
				<Card.Description>
					{m.overview.perDayHint}
				</Card.Description>
			</div>
			{#if busiest && busiest.distanceKm > 0}
				<p class="text-sm text-muted-foreground tabular-nums">
					{m.overview.busiest}
					<span class="font-medium text-foreground"
						>{prettyDay(busiest.date)}, {distance(busiest.distanceKm)}</span
					>
				</p>
			{/if}
		</Card.Header>
		<Card.Content>
			<DailyBars
				days={calendar}
				unit={units().distance}
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
							<dt class="inline">{m.overview.distance}</dt>
							<dd class="inline text-foreground tabular-nums">
								{distance(dayDetail.distanceKm, 1)}
							</dd>
						</div>
						<div>
							<dt class="inline">{m.overview.trips}</dt>
							<dd class="inline text-foreground tabular-nums">{dayDetail.trips}</dd>
						</div>
						<div>
							<dt class="inline">{m.overview.driving}</dt>
							<dd class="inline text-foreground tabular-nums">
								{duration(dayDetail.drivingSeconds, 'short')}
							</dd>
						</div>
						<div>
							<dt class="inline">{m.overview.charged}</dt>
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
				<h2 class="text-lg font-semibold">{m.overview.latestTrips}</h2>
				<a href="/dash/trips" class="text-sm text-primary-link">
					{m.overview.allTrips(num(stats.trips.length))}
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
								{route(trip.startTime) || m.overview.noPlace}
							</span>
							<span class="text-sm tabular-nums">{distance(trip.distanceKm, 1)}</span>
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
				<h2 class="text-lg font-semibold">{m.overview.latestCharging}</h2>
				<a href="/dash/charging" class="text-sm text-primary-link">
					{m.overview.allSessions(num(stats.charging.sessions.length))}
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
									{session.isDc ? m.overview.dcFast : m.overview.ac} · {duration(
										session.duration,
										'short'
									)}
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
						{m.overview.noCharging}
					</li>
				{/each}
			</ul>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg">{m.overview.coverage}</Card.Title>
			<Card.Description>
				{m.overview.coverageHint}
				{#if stats.sources > 1}
					{m.overview.coverageSources(stats.sources, stats.recordedDays)}
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-6 sm:grid-cols-3">
			<BigStat
				kicker={m.overview.samples}
				value={num(dataset.time.length)}
				size="sm"
				accent="--viz-3"
				detail={m.overview.samplesDetail(percent(coverage))}
			/>
			<BigStat
				kicker={m.overview.silence}
				value={duration(stats.drain.longestSleepHours * 3600, 'short')}
				size="sm"
				accent="--viz-5"
				detail={m.overview.silenceDetail}
			/>
			<BigStat
				kicker={m.overview.signals}
				value={num([...dataset.columns.values()].filter((column) => column.nonNull > 0).length)}
				size="sm"
				accent="--viz-7"
				detail={m.overview.signalsDetail(dataset.emptyColumns.length)}
			/>
		</Card.Content>
	</Card.Root>
</div>
