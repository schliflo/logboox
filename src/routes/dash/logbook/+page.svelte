<!--
  The Fahrtenbuch, read back.

  Everywhere else in this app the car is the witness. Here the driver is: none
  of these places exists in the export, and the only reason this page can say
  "you were at the office by half past eight on four days out of five" is that
  somebody wrote the word "office" against four trips.

  Which is also why it opens with what is missing. A logbook kept for tax has
  to account for every kilometre, and an odometer that jumps between one trip
  and the next is the gap that invalidates it.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import BigStat from '$lib/components/charts/BigStat.svelte';
	import Punchcard from '$lib/components/charts/Punchcard.svelte';
	import { data } from '$lib/state/dataset.svelte';
	import { logbook } from '$lib/state/logbook.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { analyseLogbook } from '$lib/logbook/analytics';
	import { PURPOSES, type Purpose } from '$lib/logbook/types';
	import { dateOnly, duration, num, percent } from '$lib/utils/format';
	import BookIcon from '@lucide/svelte/icons/book-marked';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	const stats = $derived(data.derived!);
	const notes = $derived(logbook.bound.byTrip);

	const analysis = $derived(
		analyseLogbook(stats.trips, notes, settings.timeZone, settings.pricePerKwh)
	);

	let openRoute = $state<string | null>(null);
	let selectedPlace = $state<string | null>(null);

	const place = $derived(
		analysis.places.find((entry) => entry.place === selectedPlace) ?? analysis.places[0] ?? null
	);

	const purposeLabels: Record<string, string> = {
		...Object.fromEntries(PURPOSES.map((p) => [p.value, p.label])),
		unlabelled: 'Not said'
	};

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
					Nothing written down yet
				</Card.Title>
				<Card.Description>
					There is no location data anywhere in an XPeng export — not one coordinate. Write where a
					trip started and ended and this page fills in: the routes you actually drive, when you
					usually leave, what each purpose costs, and whether the book accounts for every kilometre.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button
					href="/dash/trips{analysis.coverage.nextUnlabelled !== null
						? `?trip=${analysis.coverage.nextUnlabelled}`
						: ''}"
				>
					Label a trip
					<ArrowRightIcon class="size-4" />
				</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="mx-auto max-w-6xl space-y-6">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Written down"
						value={percent(analysis.coverage.labelled / Math.max(1, analysis.coverage.trips))}
						size="sm"
						accent="--viz-1"
						detail="{num(analysis.coverage.labelled)} of {num(analysis.coverage.trips)} trips"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Routes"
						value={num(analysis.routes.length)}
						size="sm"
						accent="--viz-3"
						detail={analysis.routes[0]
							? `Most driven: ${routeId(analysis.routes[0].origin, analysis.routes[0].destination)}`
							: undefined}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Business"
						value={percent(analysis.purposes.find((p) => p.purpose === 'business')?.share ?? 0)}
						size="sm"
						accent="--viz-4"
						detail="of the distance recorded"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Unaccounted for"
						value={num(analysis.coverage.unrecordedKm, 0)}
						unit="km"
						size="sm"
						accent={analysis.coverage.unrecordedKm > 0 ? '--viz-8' : '--viz-6'}
						detail={analysis.coverage.gaps.length === 0
							? 'The book is continuous'
							: `${num(analysis.coverage.gaps.length)} gaps between trips`}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>By purpose</Card.Title>
					<Card.Description>
						Distance, time and what the electricity cost at {settings.formatCurrency(
							settings.pricePerKwh
						)} per kWh.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Purpose</Table.Head>
								<Table.Head class="text-right">Trips</Table.Head>
								<Table.Head class="text-right">Distance</Table.Head>
								<Table.Head class="text-right">Cost</Table.Head>
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
									<Table.Cell class="text-right tabular-nums">{num(row.km, 0)} km</Table.Cell>
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
						<Card.Title>When you arrive</Card.Title>
						<Card.Description>
							Arrivals by weekday and hour, from the trips that end there.
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
							label="Arrivals at {place.place}"
							unit="arrivals"
							formatValue={(value) => `${num(value)} arrivals`}
						/>
						<p class="mt-2 text-xs text-muted-foreground">
							{num(place.arrivals)} arrivals · {num(place.departures)} departures
						</p>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		{#if analysis.commute}
			<Card.Root>
				<Card.Header>
					<Card.Title>The commute</Card.Title>
					<Card.Description>
						The one journey you make more than any other, in both directions.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-6 sm:grid-cols-3">
					<BigStat
						kicker="Out"
						value={clock(analysis.commute.outbound.medianDeparture)}
						size="sm"
						accent="--viz-1"
						detail="{duration(analysis.commute.outbound.medianSeconds, 'short')} to {analysis
							.commute.outbound.destination}"
					/>
					<BigStat
						kicker="Back"
						value={clock(analysis.commute.inbound.medianDeparture)}
						size="sm"
						accent="--viz-3"
						detail="{duration(analysis.commute.inbound.medianSeconds, 'short')} home"
					/>
					<BigStat
						kicker="Departure wanders by"
						value={num(analysis.commute.departureSpread)}
						unit="min"
						size="sm"
						accent="--viz-4"
						detail="between the earliest and the latest"
					/>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header>
				<Card.Title>Routes</Card.Title>
				<Card.Description>
					The usual drive rather than the average one, so a single crawl through roadworks does not
					stand for the journey.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Route</Table.Head>
								<Table.Head class="text-right">Trips</Table.Head>
								<Table.Head class="text-right">Usually</Table.Head>
								<Table.Head class="text-right">Leaves</Table.Head>
								<Table.Head class="text-right">Best</Table.Head>
								<Table.Head class="text-right">kWh/100 km</Table.Head>
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
											? num(route.medianConsumption, 1)
											: '—'}
									</Table.Cell>
								</Table.Row>
								{#if openRoute === routeId(route.origin, route.destination)}
									<Table.Row class="bg-muted/30">
										<Table.Cell colspan={6}>
											<div class="flex flex-wrap items-center gap-2 py-1 text-xs">
												<span class="text-muted-foreground">
													{num(route.km, 0)} km in all · {num(route.weekdayTrips)} on weekdays,
													{num(route.weekendTrips)} at weekends · last driven {dateOnly(
														route.lastDriven
													)}
												</span>
												{#each route.tripIndices.slice(0, 12) as index (index)}
													<a
														href="/dash/trips?trip={index}"
														class="rounded border px-1.5 py-0.5 hover:bg-background"
													>
														Trip {index + 1}
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
					<Card.Title>Completeness</Card.Title>
					<Card.Description>
						A logbook kept for tax has to account for every kilometre the car moved.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if analysis.coverage.nextUnlabelled !== null}
						<div class="flex flex-wrap items-center gap-3">
							<p class="text-sm">
								{num(analysis.coverage.trips - analysis.coverage.labelled)} trips have nothing written
								against them.
							</p>
							<Button
								href="/dash/trips?trip={analysis.coverage.nextUnlabelled}"
								size="sm"
								variant="outline"
							>
								Label the next one
							</Button>
						</div>
					{/if}

					{#if analysis.coverage.gaps.length > 0}
						<div class="space-y-2">
							<p class="text-sm">
								{num(analysis.coverage.unrecordedKm, 0)} km sit between the end of one trip and the start
								of the next. The car moved without the export recording it — most often because it was
								driven while the logger was asleep, or across the seam between two exports.
							</p>
							<ul class="divide-y rounded-lg border text-xs">
								{#each analysis.coverage.gaps.slice(0, 8) as gap (gap.after)}
									<li class="flex items-center gap-3 p-2">
										<span class="text-muted-foreground tabular-nums">{dateOnly(gap.after)}</span>
										<span class="tabular-nums">
											{num(gap.fromOdo, 0)} → {num(gap.toOdo, 0)} km
										</span>
										<span class="ml-auto font-medium tabular-nums">+{num(gap.km, 0)} km</span>
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
