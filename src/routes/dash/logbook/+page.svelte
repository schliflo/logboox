<!--
  The logbook (Fahrtenbuch), read back.

  Everywhere else in this app the car is the witness. Here the driver is: none
  of these places exists in the export, and the only reason this page can say
  "you were at the office by half past eight on four days out of five" is that
  somebody wrote the word "office" against four trips.

  Which is also why it opens with what is missing. A logbook kept for tax has
  to account for every kilometre, and an odometer that jumps between one trip
  and the next is the gap that invalidates it.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import Punchcard from '#lib/components/charts/Punchcard.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { tripLink } from '#lib/data/range.js';
	import { logbook } from '#lib/state/logbook.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import ExportMenu from '#lib/components/app/ExportMenu.svelte';
	import { analyseLogbook } from '#lib/logbook/analytics.js';
	import { logbookDocument } from '#lib/logbook/document.js';
	import { PURPOSES, type Purpose } from '#lib/logbook/types.js';
	import {
		dateOnly,
		distance,
		duration,
		maskVin,
		num,
		percent,
		toConsumption,
		toDistance,
		units
	} from '#lib/utils/format.js';
	import BookIcon from '@lucide/svelte/icons/book-marked';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	const stats = $derived(data.derived!);
	const notes = $derived(logbook.bound.byTrip);

	const analysis = $derived(
		analyseLogbook(stats.trips, notes, settings.timeZone, settings.pricePerKwh)
	);

	// The same book the trips page offers, assembled once so the two agree.
	const vehicle = $derived(
		[
			data.dataset?.vmodel,
			settings.revealVin ? data.dataset?.vin : maskVin(data.dataset?.vin ?? '')
		]
			.filter(Boolean)
			.join(' · ')
	);

	const book = $derived(
		logbookDocument(
			stats.trips,
			notes,
			settings.timeZone,
			vehicle,
			settings.pricePerKwh,
			analysis,
			settings.distanceUnit
		)
	);

	let openRoute = $state<string | null>(null);
	let selectedPlace = $state<string | null>(null);

	// The analysis names trips by position in this view; a link names them by start.
	const startOf = (index: number) => stats.trips[index].startTime;
	const nextUnlabelled = $derived(
		analysis.coverage.nextUnlabelled === null ? null : startOf(analysis.coverage.nextUnlabelled)
	);

	const unwritten = $derived(analysis.coverage.trips - analysis.coverage.labelled);

	const place = $derived(
		analysis.places.find((entry) => entry.place === selectedPlace) ?? analysis.places[0] ?? null
	);

	const purposeLabels: Record<string, string> = $derived({
		...Object.fromEntries(PURPOSES.map((p) => [p.value, p.label])),
		unlabelled: m.logbookPage.notSaid
	});

	/** Minutes since midnight as a clock reading. */
	function clock(minutes: number): string {
		if (!Number.isFinite(minutes)) return '—';
		const whole = Math.round(minutes);
		return `${String(Math.floor(whole / 60) % 24).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
	}

	function routeId(origin: string, destination: string): string {
		return `${origin} → ${destination}`;
	}

	function purposeOf(value: Purpose | ''): string {
		return value ? (purposeLabels[value] ?? value) : '';
	}
</script>

{#if analysis.coverage.labelled === 0}
	<div class="mx-auto max-w-2xl">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<BookIcon class="size-5 text-primary" />
					{m.logbookPage.emptyTitle}
				</Card.Title>
				<Card.Description>
					{m.logbookPage.emptyHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href={nextUnlabelled !== null ? tripLink(nextUnlabelled) : '/dash/trips'}>
					{m.logbookPage.labelTrip}
					<ArrowRightIcon class="size-4" />
				</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="mx-auto max-w-6xl space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">{m.logbookPage.title}</h1>
				<p class="text-sm text-muted-foreground">
					{m.logbookPage.summary(
						num(analysis.coverage.labelled),
						num(analysis.coverage.trips),
						analysis.coverage.trips,
						distance(analysis.coverage.km)
					)}
				</p>
			</div>
			<ExportMenu
				kind="fahrtenbuch"
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
		</div>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker={m.logbookPage.writtenDown}
						value={percent(analysis.coverage.labelled / Math.max(1, analysis.coverage.trips))}
						size="sm"
						accent="--viz-1"
						detail={m.logbookPage.ofTrips(
							num(analysis.coverage.labelled),
							num(analysis.coverage.trips),
							analysis.coverage.trips
						)}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker={m.logbookPage.routes}
						value={num(analysis.routes.length)}
						size="sm"
						accent="--viz-3"
						detail={analysis.routes[0]
							? m.logbookPage.mostDriven(
									routeId(analysis.routes[0].origin, analysis.routes[0].destination)
								)
							: undefined}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker={m.logbookPage.business}
						value={percent(analysis.purposes.find((p) => p.purpose === 'business')?.share ?? 0)}
						size="sm"
						accent="--viz-4"
						detail={m.logbookPage.ofDistance}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker={m.logbookPage.unaccounted}
						value={num(toDistance(analysis.coverage.unrecordedKm), 0)}
						unit={units().distance}
						size="sm"
						accent={analysis.coverage.unrecordedKm > 0 ? '--viz-8' : '--viz-6'}
						detail={analysis.coverage.gaps.length === 0
							? m.logbookPage.continuous
							: m.logbookPage.gaps(
									num(analysis.coverage.gaps.length),
									analysis.coverage.gaps.length
								)}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.logbookPage.byPurpose}</Card.Title>
					<Card.Description>
						{m.logbookPage.byPurposeHint(settings.formatCurrency(settings.pricePerKwh))}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{m.logbookPage.purpose}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.trips}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.distance}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.cost}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each analysis.purposes as row (row.purpose)}
								<Table.Row>
									<Table.Cell class="font-medium">
										{purposeLabels[row.purpose] ?? row.purpose}
										<span class="ml-2 text-xs text-muted-foreground">
											{percent(row.share)}
										</span>
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{num(row.trips)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{distance(row.km)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{settings.formatCurrency(row.cost)}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>

			{#if place}
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.logbookPage.whenArrive}</Card.Title>
						<Card.Description>
							{m.logbookPage.whenArriveHint}
						</Card.Description>
						<Card.Action>
							<Select.Root
								type="single"
								value={place.place}
								onValueChange={(value) => (selectedPlace = value)}
							>
								<Select.Trigger class="w-40">{place.place}</Select.Trigger>
								<Select.Content>
									{#each analysis.places as entry (entry.place)}
										<Select.Item value={entry.place}>{entry.place}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						<Punchcard
							grid={place.arrivalGrid}
							label={m.logbookPage.arrivalsAt(place.place)}
							unit={m.logbookPage.arrivalsUnit}
							formatValue={(value) => m.logbookPage.arrivals(num(value), value)}
						/>
						<p class="mt-2 text-xs text-muted-foreground">
							{m.logbookPage.arrivals(num(place.arrivals), place.arrivals)} ·
							{m.logbookPage.departures(num(place.departures), place.departures)}
						</p>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		{#if analysis.commute}
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.logbookPage.commute}</Card.Title>
					<Card.Description>
						{m.logbookPage.commuteHint}
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-6 sm:grid-cols-3">
					<BigStat
						kicker={m.logbookPage.out}
						value={clock(analysis.commute.outbound.medianDeparture)}
						size="sm"
						accent="--viz-1"
						detail={m.logbookPage.outDetail(
							duration(analysis.commute.outbound.medianSeconds, 'short'),
							analysis.commute.outbound.destination
						)}
					/>
					<BigStat
						kicker={m.logbookPage.back}
						value={clock(analysis.commute.inbound.medianDeparture)}
						size="sm"
						accent="--viz-3"
						detail={m.logbookPage.backDetail(
							duration(analysis.commute.inbound.medianSeconds, 'short')
						)}
					/>
					<BigStat
						kicker={m.logbookPage.wanders}
						value={num(analysis.commute.departureSpread)}
						unit="min"
						size="sm"
						accent="--viz-4"
						detail={m.logbookPage.wandersDetail}
					/>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.logbookPage.routes}</Card.Title>
				<Card.Description>
					{m.logbookPage.routesHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{m.logbookPage.route}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.trips}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.usually}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.leaves}</Table.Head>
								<Table.Head class="text-right">{m.logbookPage.best}</Table.Head>
								<Table.Head class="text-right">{units().consumption}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each analysis.routes as route (routeId(route.origin, route.destination))}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50"
									onclick={() =>
										(openRoute =
											openRoute === routeId(route.origin, route.destination)
												? null
												: routeId(route.origin, route.destination))}
								>
									<Table.Cell class="font-medium">
										{route.origin} → {route.destination}
										{#if route.purpose}
											<Badge variant="secondary" class="ml-2">{purposeOf(route.purpose)}</Badge>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{num(route.trips)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{duration(route.medianSeconds, 'short')}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{clock(route.medianDeparture)}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{duration(route.fastestSeconds, 'short')}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{Number.isFinite(route.medianConsumption)
											? num(toConsumption(route.medianConsumption), 1)
											: '—'}
									</Table.Cell>
								</Table.Row>
								{#if openRoute === routeId(route.origin, route.destination)}
									<Table.Row class="bg-muted/30">
										<Table.Cell colspan={6}>
											<div class="flex flex-wrap items-center gap-2 py-1 text-xs">
												<span class="text-muted-foreground">
													{m.logbookPage.routeDetail(
														distance(route.km),
														num(route.weekdayTrips),
														num(route.weekendTrips),
														dateOnly(route.lastDriven)
													)}
												</span>
												{#each route.tripIndices.slice(0, 12) as index (index)}
													<a
														href={tripLink(startOf(index))}
														class="rounded border px-1.5 py-0.5 hover:bg-background"
													>
														{m.logbookPage.trip(index + 1)}
													</a>
												{/each}
											</div>
										</Table.Cell>
									</Table.Row>
								{/if}
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</Card.Content>
		</Card.Root>

		{#if analysis.coverage.nextUnlabelled !== null || analysis.coverage.gaps.length > 0}
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.logbookPage.completeness}</Card.Title>
					<Card.Description>
						{m.logbookPage.completenessHint}
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if analysis.coverage.nextUnlabelled !== null}
						<div class="flex flex-wrap items-center gap-3">
							<p class="text-sm">
								{m.logbookPage.unwritten(num(unwritten), unwritten)}
							</p>
							<Button
								href={nextUnlabelled !== null ? tripLink(nextUnlabelled) : '/dash/trips'}
								size="sm"
								variant="outline"
							>
								{m.logbookPage.labelNext}
							</Button>
						</div>
					{/if}

					{#if analysis.coverage.gaps.length > 0}
						<div class="space-y-2">
							<p class="text-sm">
								{m.logbookPage.gapExplain(
									distance(analysis.coverage.unrecordedKm),
									Math.round(analysis.coverage.unrecordedKm)
								)}
							</p>
							<ul class="divide-y rounded-lg border text-xs">
								{#each analysis.coverage.gaps.slice(0, 8) as gap (gap.after)}
									<li class="flex items-center gap-3 p-2">
										<span class="text-muted-foreground tabular-nums">{dateOnly(gap.after)}</span>
										<span class="tabular-nums">
											{num(toDistance(gap.fromOdo), 0)} → {distance(gap.toOdo)}
										</span>
										<span class="ml-auto font-medium tabular-nums">+{distance(gap.km)}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
