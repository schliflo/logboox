<!--
  Distance per day as bars, with the daily average as a dashed line. A day
  that was never recorded gets a faint stub rather than a zero, so a gap in the
  record does not read as a day parked. Selecting a bar hands its date back.
-->
<script lang="ts">
	import { num, prettyDay } from '#lib/utils/format.js';
	import ChartTooltip from './ChartTooltip.svelte';

	interface Day {
		date: string;
		value: number;
		covered: boolean;
	}

	interface Props {
		days: Day[];
		unit?: string;
		accent?: string;
		height?: number;
		selected?: string | null;
		onSelect?: (date: string) => void;
	}

	let {
		days,
		unit = 'km',
		accent = '--viz-1',
		height = 180,
		selected = null,
		onSelect
	}: Props = $props();

	const max = $derived(Math.max(1, ...days.map((day) => day.value)));
	const driven = $derived(days.filter((day) => day.covered && day.value > 0));
	const average = $derived(
		driven.length ? driven.reduce((sum, day) => sum + day.value, 0) / driven.length : 0
	);
	// Every day is labelled on a month; past that, about one label in ten.
	const every = $derived(Math.max(1, Math.ceil(days.length / 31)));

	let plot = $state<HTMLDivElement>();
	let hovered = $state<number | null>(null);
	let anchor = $state({ x: 0, y: 0 });
	let plotWidth = $state(0);

	function track(event: PointerEvent): void {
		const column = (event.target as HTMLElement).closest<HTMLElement>('[data-day]');
		if (!column || !plot) {
			hovered = null;
			return;
		}
		const index = Number(column.dataset.day);
		const outer = plot.getBoundingClientRect();
		const box = column.getBoundingClientRect();
		plotWidth = outer.width;
		anchor = {
			x: box.left - outer.left + box.width / 2,
			y: height - Math.max(4, (days[index].value / max) * height)
		};
		hovered = index;
	}

	const dayOfMonth = (date: string) => String(Number(date.slice(8, 10)));
	const weekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
</script>

<figure class="flex flex-col gap-2">
	<div
		bind:this={plot}
		class="relative flex items-end gap-[3px]"
		style="height: {height}px"
		role="group"
		aria-label="Distance per day"
		onpointermove={track}
		onpointerleave={() => (hovered = null)}
	>
		{#if average > 0}
			<div
				class="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
				style="bottom: {(average / max) * 100}%"
			>
				<span
					class="absolute -top-4 right-0 text-[10px] font-semibold text-muted-foreground tabular-nums"
				>
					Ø {num(average)}
					{unit}
				</span>
			</div>
		{/if}
		{#each days as day, i (day.date)}
			<button
				type="button"
				data-day={i}
				aria-label="{prettyDay(day.date)}: {day.covered
					? `${num(day.value, 1)} ${unit}`
					: 'not recorded'}"
				aria-pressed={selected === day.date}
				disabled={!day.covered || !onSelect}
				onclick={() => onSelect?.(day.date)}
				class="relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
			>
				<span
					class="w-full rounded-t-[4px] transition-opacity"
					style="height: {day.covered && day.value > 0
						? Math.max(3, (day.value / max) * 100)
						: 2}%; background: {day.covered && day.value > 0
						? selected === day.date || day.value === max
							? `color-mix(in oklab, var(${accent}) 60%, white)`
							: `var(${accent})`
						: 'var(--border)'}; opacity: {hovered === null && !selected
						? 1
						: hovered === i || selected === day.date
							? 1
							: 0.5}"
				></span>
			</button>
		{/each}

		{#if hovered !== null}
			<ChartTooltip x={anchor.x} y={anchor.y} bounds={plotWidth}>
				<p class="font-medium">{prettyDay(days[hovered].date)}</p>
				<p class="mt-0.5 text-muted-foreground tabular-nums">
					{days[hovered].covered ? `${num(days[hovered].value, 1)} ${unit}` : 'Not recorded'}
				</p>
			</ChartTooltip>
		{/if}
	</div>

	<div class="flex gap-[3px] text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
		{#each days as day, i (day.date)}
			<span
				class="min-w-0 flex-1 text-center {weekend(day.date)
					? 'font-semibold text-foreground'
					: ''} {(i / every) % 2 ? 'max-sm:invisible' : ''}"
			>
				{i % every === 0 ? dayOfMonth(day.date) : ''}
			</span>
		{/each}
	</div>
</figure>
