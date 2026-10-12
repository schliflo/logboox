<!--
  The landing page's previews: what the demo month looks like once read.

  Every figure is the demo's own, from a snapshot cut once rather than a demo
  generated per visit (`#lib/demo/teasers`). The grip and routine tiles reuse
  the dashboard's charts, so they hover exactly as they do in the app.
-->
<script lang="ts">
	import { m, intlLocale } from '#lib/i18n/index.svelte.js';
	import { factText } from '#lib/i18n/facts.js';
	import { boardText } from '#lib/i18n/boards.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import GgDiagram from '#lib/components/charts/GgDiagram.svelte';
	import Punchcard from '#lib/components/charts/Punchcard.svelte';
	import MedalDisc from './MedalDisc.svelte';
	import PurposeChip from './PurposeChip.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { DEMO_ZONE, type Teasers } from '#lib/demo/teasers.js';
	import snapshot from '#lib/demo/teasers.json';
	import { duration, measure, num } from '#lib/utils/format.js';
	import type { Purpose } from '#lib/logbook/types.js';
	import type { Medal } from '#lib/leaderboard/medals.js';
	import type { BoardId } from '#lib/leaderboard/boards.js';
	import PlayIcon from '@lucide/svelte/icons/play';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import DownloadIcon from '@lucide/svelte/icons/download';

	const teasers = snapshot as Teasers;
	const t = $derived(m.landing.teasers);

	/** Demo times read as the wall clock they were generated on, wherever the reader is. */
	function zoned(options: Intl.DateTimeFormatOptions) {
		const format = new Intl.DateTimeFormat(intlLocale(), { ...options, timeZone: DEMO_ZONE });
		return (epochSeconds: number) => format.format(new Date(epochSeconds * 1000));
	}
	const clock = $derived(zoned({ hour: '2-digit', minute: '2-digit', hour12: false }));
	const when = $derived(
		zoned({
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		})
	);

	const wrapped = $derived(factText(teasers.longestTrip, { when }));
	const gg = teasers.gg;
	const ggGrid = Uint32Array.from(gg.cells);

	/** A polyline in a 100 × `height` box, lowest value at the bottom. */
	function line(values: number[], low: number, high: number, height: number): string {
		const last = values.length - 1;
		return values
			.map((value, i) => {
				const y = height - ((value - low) / (high - low)) * height;
				return `${i ? 'L' : 'M'}${((i / last) * 100).toFixed(2)} ${y.toFixed(2)}`;
			})
			.join(' ');
	}

	const LANE = 40;
	const { trip } = teasers;
	const peakAt = (trip.peak / (trip.speed.length - 1)) * 100;
	const lanes = $derived(
		[
			{ label: m.detail.speed, color: 'var(--viz-speed)', values: trip.speed, unit: 'km/h' },
			{ label: m.detail.power, color: 'var(--viz-accel)', values: trip.power, unit: 'kW' },
			{ label: m.detail.charge, color: 'var(--viz-soc)', values: trip.soc, unit: '%' }
		].map((lane) => {
			const low = Math.min(0, ...lane.values);
			const high = Math.max(...lane.values) || 1;
			const value = lane.values[trip.peak];
			return {
				...lane,
				path: line(lane.values, low, high, LANE),
				dot: LANE - ((value - low) / (high - low)) * LANE,
				reading: measure(value, lane.unit)
			};
		})
	);

	const { charge } = teasers;
	const chargeCeiling = charge.maxKw * 1.15;
	const chargePower = line(charge.power, 0, chargeCeiling, 100);
	const chargeArea = `${chargePower} L100 100 L0 100 Z`;
	const chargeSoc = line(charge.soc, 0, 100, 100);

	const PURPOSES: Purpose[] = ['commute', 'business', 'private'];

	const MEDALS: Array<{ medal: Medal; board: BoardId }> = [
		{ medal: 'gold', board: 'peak-charge' },
		{ medal: 'silver', board: 'longest-drive' },
		{ medal: 'bronze', board: 'hardest-launch' }
	];
</script>

{#snippet words(title: string, body: string)}
	<div class="space-y-2 p-6">
		<h3 class="font-semibold">{title}</h3>
		<p class="text-sm leading-relaxed text-muted-foreground">{body}</p>
	</div>
{/snippet}

<section aria-labelledby="inside" class="mt-24">
	<div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
		<div class="max-w-2xl space-y-3">
			<p class="eyebrow">{t.eyebrow}</p>
			<h2
				id="inside"
				class="text-4xl leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-5xl"
			>
				{t.title}
			</h2>
			<p class="text-pretty text-muted-foreground">{t.lede}</p>
		</div>
		<Button variant="outline" size="lg" class="h-11 px-5" onclick={() => data.loadDemoData()}>
			<PlayIcon class="size-4" />
			{t.openDemo}
		</Button>
	</div>

	<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- The opening sequence, one card of it. -->
		<article class="tile sm:col-span-2">
			<div
				class="viz relative grid place-items-center px-10 text-center"
				style="background: radial-gradient(55% 75% at 50% 50%, color-mix(in oklab, var(--viz-4) 26%, transparent), transparent 72%)"
			>
				<div>
					<p
						class="text-[0.6875rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						{wrapped.kicker}
					</p>
					<p class="mt-2 flex items-baseline justify-center gap-2">
						<span
							class="text-7xl leading-none font-extrabold tracking-tighter tabular-nums sm:text-8xl"
							style="color: var(--viz-4)">{wrapped.value}</span
						>
						{#if wrapped.unit}
							<span class="text-xl font-medium text-muted-foreground">{wrapped.unit}</span>
						{/if}
					</p>
					<p class="mt-3 text-sm text-foreground/80">{wrapped.detail}</p>
				</div>
				<span
					class="absolute top-1/2 right-5 flex -translate-y-1/2 flex-col items-end gap-1.5"
					aria-hidden="true"
				>
					{#each Array(7) as _, index (index)}
						<span
							class="h-1 rounded-full {index === 2 ? 'w-4' : 'w-1 bg-muted-foreground/40'}"
							style={index === 2 ? 'background: var(--viz-4)' : ''}
						></span>
					{/each}
				</span>
			</div>
			{@render words(t.wrapped.title, t.wrapped.body)}
		</article>

		<article class="tile">
			<div class="viz grid place-items-center p-3 text-left">
				<div class="w-full">
					<GgDiagram
						grid={ggGrid}
						size={gg.size}
						extent={gg.extent}
						max={gg.max}
						total={gg.total}
						height={168}
					/>
				</div>
			</div>
			{@render words(t.grip.title, t.grip.body)}
		</article>

		<article class="tile">
			<div class="viz flex flex-col gap-2 px-5 pt-4 pb-3">
				<p
					class="self-end rounded-md border bg-card px-2 py-0.5 text-[0.6875rem] whitespace-nowrap tabular-nums"
				>
					<span class="text-muted-foreground">{clock(trip.startTime + trip.peak * trip.step)}</span>
					· {lanes.map((lane) => lane.reading).join(' · ')}
				</p>
				<div class="relative flex-1" role="img" aria-label={t.trip.title}>
					<span
						class="absolute inset-y-0 border-l border-dashed border-muted-foreground/60"
						style="left: {peakAt}%"
						aria-hidden="true"
					></span>
					{#each lanes as lane (lane.label)}
						<div class="mb-1.5">
							<p class="text-[0.625rem] text-muted-foreground">{lane.label}</p>
							<div class="relative" style="height: {LANE}px">
								<svg
									viewBox="0 0 100 {LANE}"
									preserveAspectRatio="none"
									class="absolute inset-0 size-full overflow-visible"
									aria-hidden="true"
								>
									<path
										d={lane.path}
										fill="none"
										stroke={lane.color}
										stroke-width="1.5"
										stroke-linejoin="round"
										vector-effect="non-scaling-stroke"
									/>
								</svg>
								<span
									class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
									style="left: {peakAt}%; top: {lane.dot}px; background: {lane.color}"
								></span>
							</div>
						</div>
					{/each}
				</div>
			</div>
			{@render words(t.trip.title, t.trip.body)}
		</article>

		<article class="tile">
			<div class="viz flex flex-col gap-3 px-5 pt-4 pb-4">
				<p class="flex flex-wrap gap-1.5 text-[0.6875rem] tabular-nums">
					<span class="chip"
						><span style="color: var(--viz-charge)">{measure(charge.kwh, 'kWh')}</span></span
					>
					<span class="chip">{duration(charge.duration)}</span>
					<span class="chip">{t.charging.peak(measure(charge.maxKw, 'kW'))}</span>
				</p>
				<div class="relative flex-1" role="img" aria-label={t.charging.title}>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						class="absolute inset-0 size-full overflow-visible"
						aria-hidden="true"
					>
						<path d={chargeArea} fill="color-mix(in oklab, var(--viz-charge) 22%, transparent)" />
						<path
							d={chargePower}
							fill="none"
							stroke="var(--viz-charge)"
							stroke-width="1.5"
							vector-effect="non-scaling-stroke"
						/>
						<path
							d={chargeSoc}
							fill="none"
							stroke="var(--viz-soc)"
							stroke-width="2"
							stroke-linecap="round"
							vector-effect="non-scaling-stroke"
						/>
					</svg>
					<span
						class="absolute left-1 -translate-y-full pb-1 text-xs font-semibold tabular-nums"
						style="top: {100 - charge.socStart}%; color: var(--viz-soc)"
						>{num(charge.socStart)} %</span
					>
					<span
						class="absolute right-1 -translate-y-full pb-1 text-xs font-semibold tabular-nums"
						style="top: {100 - charge.socEnd}%; color: var(--viz-soc)">{num(charge.socEnd)} %</span
					>
				</div>
			</div>
			{@render words(t.charging.title, t.charging.body)}
		</article>

		<article class="tile">
			<div class="viz flex flex-col gap-2 px-5 py-4 text-sm">
				{#each teasers.logbook as entry, index (entry.startTime)}
					<p class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
						<span class="text-muted-foreground tabular-nums">{clock(entry.startTime)}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate">{t.logbook.places[index]}</span>
							<span class="block text-xs text-muted-foreground tabular-nums">
								{measure(entry.distanceKm, 'km')} · {duration(entry.duration, 'short')}
							</span>
						</span>
						<PurposeChip purpose={PURPOSES[index]} />
					</p>
				{/each}
				<p class="mt-auto flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
					<DownloadIcon class="size-3.5" aria-hidden="true" />
					<span class="chip">PDF</span>
					<span class="chip">XLSX</span>
					<span class="chip">CSV</span>
				</p>
			</div>
			{@render words(t.logbook.title, t.logbook.body)}
		</article>

		<article class="tile sm:col-span-2">
			<div class="viz grid content-center justify-items-center px-5 py-4 text-left">
				<div class="w-full max-w-xl">
					<Punchcard
						grid={teasers.doors}
						label={m.doorsPage.openings}
						formatValue={(value) => m.doorsPage.openingsCount(num(value))}
					/>
				</div>
			</div>
			{@render words(t.routine.title, t.routine.body)}
		</article>

		<article class="tile sm:col-span-2 lg:col-span-1">
			<div class="viz flex items-center justify-center gap-5 px-5">
				{#each MEDALS as { medal, board } (board)}
					<div class="flex w-20 flex-col items-center gap-2 self-start pt-16 text-center">
						<MedalDisc {medal} {board} size={60} glow={medal === 'gold'} />
						<span class="text-xs leading-snug text-muted-foreground">{boardText(board).label}</span>
					</div>
				{/each}
			</div>
			<div class="space-y-2 p-6">
				<h3 class="font-semibold">{t.boards.title}</h3>
				<p class="text-sm leading-relaxed text-muted-foreground">{t.boards.body}</p>
				<a
					href="/leaderboard"
					class="inline-flex items-center gap-1.5 pt-1 text-sm font-medium underline-offset-4 hover:underline"
					style="color: var(--viz-1)"
				>
					{t.boards.cta}
					<ArrowRightIcon class="size-4" />
				</a>
			</div>
		</article>
	</div>
</section>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--card);
	}

	.viz {
		height: 15rem;
		border-bottom: 1px solid var(--border);
		background: color-mix(in oklab, var(--muted) 45%, var(--card));
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--card);
		padding: 0.125rem 0.5rem;
		color: var(--foreground);
	}
</style>
