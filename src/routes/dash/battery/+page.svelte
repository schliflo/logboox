<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import PageFindings from '#lib/components/app/PageFindings.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import UPlotChart, { type ChartSeries } from '#lib/components/charts/UPlotChart.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { breakAtGaps, selectSeries } from '#lib/data/store/decimate.js';
	import { AWAKE_GAP_SECONDS } from '#lib/data/analytics/sessions.js';
	import { dateTime, distance, duration, num, toDistance, units } from '#lib/utils/format.js';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);

	/**
	 * The whole month of charge on one chart. It is downsampled to roughly two
	 * points per pixel and broken wherever the car stopped logging, so the line
	 * never invents a value for a night it slept through.
	 */
	const socSeries = $derived.by(() => {
		const column = dataset.columns.get('ldcu_bms_soc_disp');
		if (!column || column.nonNull === 0) return null;
		const pyramid = data.pyramids?.get(column) ?? null;
		const raw = selectSeries(dataset.time, column, pyramid, stats.startTime, stats.endTime, 1200);
		return breakAtGaps(raw, AWAKE_GAP_SECONDS * 5);
	});

	const rangeSeries = $derived.by(() => {
		const column = dataset.columns.get('ldcu_dstbatdisp_dynamic');
		if (!column || column.nonNull === 0) return null;
		const pyramid = data.pyramids?.get(column) ?? null;
		const raw = selectSeries(dataset.time, column, pyramid, stats.startTime, stats.endTime, 1200);
		return breakAtGaps(raw, AWAKE_GAP_SECONDS * 5);
	});

	const tempSeries = $derived.by(() => {
		const hot = dataset.columns.get('bms_batttempmax_gb');
		const cold = dataset.columns.get('bms_batttempmin_gb');
		if (!hot || !cold || hot.nonNull === 0) return null;
		const hotPyramid = data.pyramids?.get(hot) ?? null;
		const coldPyramid = data.pyramids?.get(cold) ?? null;
		const a = breakAtGaps(
			selectSeries(dataset.time, hot, hotPyramid, stats.startTime, stats.endTime, 1200),
			AWAKE_GAP_SECONDS * 5
		);
		const b = breakAtGaps(
			selectSeries(dataset.time, cold, coldPyramid, stats.startTime, stats.endTime, 1200),
			AWAKE_GAP_SECONDS * 5
		);
		// Both lines must share an x vector to sit on one chart.
		if (a.x.length !== b.x.length) return null;
		return { x: a.x, hot: a.y, cold: b.y };
	});

	const socChart = $derived<ChartSeries[]>(
		socSeries
			? [
					{
						label: m.battery.charge,
						color: '--viz-soc',
						unit: '%',
						fill: true,
						values: socSeries.y
					}
				]
			: []
	);
</script>

<div class="mx-auto max-w-6xl space-y-6">
	<PageFindings />
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.battery.fullRange}
					value={num(toDistance(stats.range.medianFullRange))}
					unit={units().distance}
					size="sm"
					accent="--viz-3"
					detail={m.battery.fullRangeDetail(
						num(toDistance(stats.range.minFullRange)),
						distance(stats.range.maxFullRange)
					)}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.battery.lostParked}
					value={num(stats.drain.medianPercentPerDay, 1)}
					unit="%/day"
					size="sm"
					accent="--viz-5"
					detail={m.battery.lostParkedDetail(
						stats.drain.events.length,
						num(stats.drain.totalSleepHours)
					)}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.battery.packTemp}
					value="{num(stats.thermal.minTemp)}–{num(stats.thermal.maxTemp)}"
					unit="°C"
					size="sm"
					accent="--viz-2"
					detail={m.battery.spreadDetail(num(stats.thermal.maxSpread))}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<BigStat
					kicker={m.battery.socUsed}
					value="{num(Math.min(...stats.days.map((d) => d.socMin).filter(Number.isFinite)))}–{num(
						Math.max(...stats.days.map((d) => d.socMax).filter(Number.isFinite))
					)}"
					unit="%"
					size="sm"
					accent="--viz-4"
					detail={m.battery.socUsedDetail}
				/>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.battery.monthOfCharge}</Card.Title>
			<Card.Description>
				{m.battery.monthOfChargeHint}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if socSeries}
				<UPlotChart
					x={socSeries.x}
					series={socChart}
					height={220}
					syncKey="battery"
					yRange={[0, 100]}
				/>
			{/if}
		</Card.Content>
	</Card.Root>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.battery.predicted}</Card.Title>
				<Card.Description>{m.battery.predictedHint}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if rangeSeries}
					<UPlotChart
						x={rangeSeries.x}
						series={[
							{
								label: m.battery.range,
								color: '--viz-1',
								unit: units().distance,
								fill: true,
								values: rangeSeries.y.map(toDistance)
							}
						]}
						height={200}
						syncKey="battery"
					/>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.battery.packTemp}</Card.Title>
				<Card.Description>
					{m.battery.packTempHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if tempSeries}
					<UPlotChart
						x={tempSeries.x}
						series={[
							{ label: m.battery.warmest, color: '--viz-8', unit: '°C', values: tempSeries.hot },
							{ label: m.battery.coolest, color: '--viz-1', unit: '°C', values: tempSeries.cold }
						]}
						height={200}
						syncKey="battery"
					/>
					<div class="mt-2 flex gap-4 text-xs text-muted-foreground">
						<span class="flex items-center gap-1.5">
							<span class="h-0.5 w-3 rounded-full" style="background: var(--viz-8)"></span>
							{m.battery.warmest}
						</span>
						<span class="flex items-center gap-1.5">
							<span class="h-0.5 w-3 rounded-full" style="background: var(--viz-1)"></span>
							{m.battery.coolest}
						</span>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	{#if stats.drain.events.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.battery.standing}</Card.Title>
				<Card.Description>
					{m.battery.standingHint}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{m.battery.parkedFrom}</Table.Head>
								<Table.Head class="text-right">{m.battery.for}</Table.Head>
								<Table.Head class="text-right">{m.battery.charge}</Table.Head>
								<Table.Head class="text-right">{m.battery.lost}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each stats.drain.events.slice(0, 12) as event (event.startTime)}
								<Table.Row>
									<Table.Cell>{dateTime(event.startTime)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{duration(event.hours * 3600, 'short')}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{num(event.socStart)}% → {num(event.socEnd)}%
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{num(event.socLost)}%
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
