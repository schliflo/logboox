<!--
  One charging session.

  Two panels: what the charger delivered, and what the battery did with it.
  Power tapering as the pack fills is the shape worth seeing, and the flat top
  before it is whatever the charger could manage.

  Takes its samples as arguments, like the trip panels, so a session reached
  through a public link draws exactly as one in the dashboard does.
-->
<script lang="ts">
	import UPlotChart, { type ChartSeries } from '$lib/components/charts/UPlotChart.svelte';
	import { decodeRange } from '$lib/data/store/columnar';
	import type { SampleSource } from './TripDetail.svelte';

	interface Props {
		source: SampleSource;
		from: number;
		to: number;
		syncKey: string;
	}

	let { source, from, to, syncKey }: Props = $props();

	const x = $derived.by(() => {
		const out = new Float64Array(to - from + 1);
		for (let i = 0; i < out.length; i++) out[i] = source.time[from + i];
		return out;
	});

	function series(key: string, label: string, color: string, unit: string): ChartSeries | null {
		const column = source.columns.get(key);
		if (!column || column.nonNull === 0) return null;
		return { label, color, unit, fill: true, values: decodeRange(column, from, to + 1) };
	}

	const power = $derived(series('ldcu_chrgpwr', 'Charging power', '--viz-charge', 'kW'));
	const soc = $derived(series('ldcu_bms_soc_disp', 'State of charge', '--viz-soc', '%'));
</script>

<div class="space-y-4">
	{#if power}
		<figure class="space-y-1">
			<figcaption class="text-xs text-muted-foreground">Power at the plug</figcaption>
			<UPlotChart {x} series={[power]} height={170} {syncKey} />
		</figure>
	{/if}
	{#if soc}
		<figure class="space-y-1">
			<figcaption class="text-xs text-muted-foreground">State of charge</figcaption>
			<UPlotChart {x} series={[soc]} height={140} {syncKey} />
		</figure>
	{/if}
</div>
