<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import PageFindings from '#lib/components/app/PageFindings.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import Punchcard from '#lib/components/charts/Punchcard.svelte';
	import UPlotChart from '#lib/components/charts/UPlotChart.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { columnLabel } from '#lib/i18n/columns.js';
	import { duration, hourLabel, num } from '#lib/utils/format.js';

	const stats = $derived(data.derived!);
	const doors = $derived(stats.doors);
	const tyres = $derived(stats.tyres);

	const doorLabels = $derived(m.doorsPage.doors);

	/** Daily median pressure per wheel, plotted as four lines over the month. */
	const tyreChart = $derived.by(() => {
		const days = tyres.days.filter((day) => day.pressures.some((p) => !Number.isNaN(p)));
		if (days.length < 2) return null;
		const x = Float64Array.from(
			days.map((day) => {
				const [y, m, d] = day.date.split('-').map(Number);
				return Date.UTC(y, m - 1, d) / 1000;
			})
		);
		return {
			x,
			series: tyres.labels.map((label, wheel) => ({
				label: m.doorsPage.wheels[wheel] ?? label,
				color: `--viz-${wheel + 1}`,
				unit: 'kPa',
				values: Float64Array.from(days.map((day) => day.pressures[wheel]))
			}))
		};
	});

	const rearHigher = $derived.by(() => {
		const front = (tyres.drift[0] + tyres.drift[1]) / 2;
		const rear = (tyres.drift[2] + tyres.drift[3]) / 2;
		return { front, rear };
	});
</script>

<div class="mx-auto max-w-6xl space-y-6">
	<PageFindings />
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.doorsPage.schedule}</Card.Title>
			<Card.Description>
				{m.doorsPage.scheduleHint}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<Punchcard
				grid={doors.grid}
				label={m.doorsPage.openings}
				formatValue={(value) => m.doorsPage.openingsCount(num(value))}
			/>

			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				<BigStat
					kicker={m.doorsPage.recorded}
					value={num(doors.events.length)}
					size="sm"
					accent="--viz-1"
				/>
				<BigStat
					kicker={m.doorsPage.busiestHour}
					value={hourLabel(doors.busiestHour)}
					size="sm"
					accent="--viz-3"
					detail={m.doorsPage.openingsCount(num(doors.busiestHourCount))}
				/>
				{#if doors.quietStretch && doors.quietStretch.hours >= 3}
					<BigStat
						kicker={m.doorsPage.neverBetween}
						value="{hourLabel(doors.quietStretch.from)}–{hourLabel(doors.quietStretch.to)}"
						size="sm"
						accent="--viz-7"
						detail={m.doorsPage.quietDetail(doors.quietStretch.hours)}
					/>
				{/if}
				{#if doors.longestOpen}
					<BigStat
						kicker={m.doorsPage.longestOpen}
						value={duration(doors.longestOpen.openSeconds, 'short')}
						size="sm"
						accent="--viz-5"
						detail={doorLabels[doors.longestOpen.door]
							? m.doorsPage.doorName(doorLabels[doors.longestOpen.door])
							: m.doorsPage.aDoor}
					/>
				{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-4">
				{#each Object.entries(doors.perDoor) as [key, count] (key)}
					<div class="rounded-lg border bg-muted/40 p-3">
						<p class="text-xs text-muted-foreground">{doorLabels[key] ?? key}</p>
						<p class="mt-1 text-xl font-semibold tabular-nums">{num(count)}</p>
					</div>
				{/each}
			</div>

			<p class="border-l-2 pl-4 text-sm leading-relaxed text-muted-foreground">
				{m.doorsPage.rearNote}
			</p>
		</Card.Content>
	</Card.Root>

	{#if tyreChart}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.doorsPage.tyres}</Card.Title>
				<Card.Description>
					{m.doorsPage.tyresHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<UPlotChart x={tyreChart.x} series={tyreChart.series} height={220} timeFormat="day" />

				<div class="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
					{#each tyreChart.series as series (series.label)}
						<span class="flex items-center gap-1.5">
							<span class="h-0.5 w-3 rounded-full" style="background: var({series.color})"></span>
							{series.label}
						</span>
					{/each}
				</div>

				<div class="mt-6 grid gap-6 sm:grid-cols-3">
					<BigStat
						kicker={m.doorsPage.pressureRange}
						value="{num(tyres.minPressure)}–{num(tyres.maxPressure)}"
						unit="kPa"
						size="sm"
						accent="--viz-1"
						detail={m.doorsPage.pressureSteps}
					/>
					<BigStat
						kicker={m.doorsPage.change}
						value="{rearHigher.front >= 0 ? '+' : ''}{num(rearHigher.front, 1)}"
						unit={m.doorsPage.front}
						size="sm"
						accent="--viz-2"
						detail={m.doorsPage.rear(
							`${rearHigher.rear >= 0 ? '+' : ''}${num(rearHigher.rear, 1)}`
						)}
					/>
					{#if Number.isFinite(tyres.temperatureCorrelation)}
						<BigStat
							kicker={m.doorsPage.tracks}
							value={num(tyres.temperatureCorrelation, 2)}
							size="sm"
							accent="--viz-temp"
							detail={m.doorsPage.tracksDetail}
						/>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if data.dataset && data.dataset.emptyColumns.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.doorsPage.empty}</Card.Title>
				<Card.Description>
					{m.doorsPage.emptyHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-wrap gap-2">
					{#each data.dataset.emptyColumns as key (key)}
						<span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
							{columnLabel(key)}
						</span>
					{/each}
				</div>
				<p class="mt-4 text-sm leading-relaxed text-muted-foreground">
					{m.doorsPage.emptyNote}
				</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
