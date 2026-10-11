<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import PageFindings from '#lib/components/app/PageFindings.svelte';
	import { goto } from '$app/navigation';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import GgDiagram from '#lib/components/charts/GgDiagram.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { tripLink } from '#lib/data/range.js';
	import { dateTime, duration, num } from '#lib/utils/format.js';

	const stats = $derived(data.derived!);

	/** When the trip a given moment belongs to started, so an event can link to its context. */
	function tripAt(time: number): number | null {
		const trip = stats.trips.find((t) => time >= t.startTime && time <= t.endTime);
		return trip ? trip.startTime : null;
	}

	const events = $derived([
		{
			title: m.drivingPage.hardestBraking,
			accent: '--viz-brake',
			unit: 'g',
			rows: stats.hardestBrakes.map((e) => ({ ...e, value: Math.abs(e.value) }))
		},
		{
			title: m.drivingPage.hardestAcceleration,
			accent: '--viz-3',
			unit: 'g',
			rows: stats.hardestAccels
		},
		{
			title: m.drivingPage.fastest,
			accent: '--viz-speed',
			unit: 'km/h',
			rows: stats.fastestMoments
		}
	]);
</script>

<div class="mx-auto max-w-6xl space-y-6">
	<PageFindings />
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.drivingPage.topSpeed}
					value={num(stats.speed.maxSpeed)}
					unit="km/h"
					size="sm"
					accent="--viz-speed"
					detail={dateTime(stats.speed.maxSpeedTime)}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.drivingPage.hardestStop}
					value={num(Math.abs(stats.hardestBrakes[0]?.value ?? NaN), 2)}
					unit="g"
					size="sm"
					accent="--viz-brake"
					detail={m.drivingPage.emergency}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.drivingPage.hardestLaunch}
					value={num(stats.hardestAccels[0]?.value ?? NaN, 2)}
					unit="g"
					size="sm"
					accent="--viz-3"
					detail={m.drivingPage.fullThrottle}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.drivingPage.above100}
					value={duration(
						stats.speed.secondsAbove.find((s) => s.speed === 100)?.seconds ?? 0,
						'short'
					)}
					size="sm"
					accent="--viz-2"
					detail={m.drivingPage.ofMoving(
						duration(
							stats.trips.reduce((sum, t) => sum + t.movingSeconds, 0),
							'short'
						)
					)}
				/>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.drivingPage.grip}</Card.Title>
				<Card.Description>
					{m.drivingPage.gripHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<GgDiagram
					grid={stats.gg.grid}
					size={stats.gg.size}
					extent={stats.gg.extent}
					max={stats.gg.max}
					total={stats.gg.total}
				/>
			</Card.Content>
		</Card.Root>

		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.drivingPage.speeds}</Card.Title>
					<Card.Description>{m.drivingPage.speedsHint}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Histogram
						edges={stats.speed.histogram.edges}
						counts={stats.speed.histogram.counts}
						unit="km/h"
						accent="--viz-speed"
						height={140}
						countsAreSeconds
						label={m.drivingPage.speedMoving}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>{m.drivingPage.pedal}</Card.Title>
					<Card.Description>{m.drivingPage.pedalHint}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Histogram
						edges={stats.pedalHistogram.edges}
						counts={stats.pedalHistogram.counts}
						unit="%"
						accent="--viz-accel"
						height={140}
						countsAreSeconds
						label={m.drivingPage.pedalLabel}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		{#each events as group (group.accent)}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">{group.title}</Card.Title>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Body>
							{#each group.rows.slice(0, 8) as event (event.time)}
								{@const trip = tripAt(event.time)}
								<Table.Row
									class={trip !== null ? 'cursor-pointer hover:bg-muted/50' : ''}
									onclick={() => trip !== null && goto(tripLink(trip))}
								>
									<Table.Cell class="py-2">
										<span class="font-medium tabular-nums" style="color: var({group.accent})">
											{num(event.value, group.unit === 'g' ? 2 : 0)}
										</span>
										<span class="text-xs text-muted-foreground"> {group.unit}</span>
									</Table.Cell>
									<Table.Cell class="py-2 text-right text-xs text-muted-foreground">
										{dateTime(event.time)}
										{#if group.unit === 'g' && Number.isFinite(event.speed)}
											<span class="block">{m.drivingPage.atSpeed(num(event.speed))}</span>
										{/if}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
