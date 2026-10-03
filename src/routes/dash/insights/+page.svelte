<!--
  The deeper reading, finding first.

  Each card leads with what it found, in a sentence, and only then the chart,
  so the page can be read without opening anything. The privacy account goes
  on top because it is the thing nobody thinks to ask about. Everything else
  links through to its full page.
-->
<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import GgDiagram from '#lib/components/charts/GgDiagram.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { duration, hourLabel, num, percent } from '#lib/utils/format.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);

	const hardestStop = $derived(Math.abs(stats.hardestBrakes[0]?.value ?? NaN));
	const hardestLaunch = $derived(stats.hardestAccels[0]?.value ?? NaN);
	const hardestCorner = $derived(
		stats.trips.reduce((most, trip) => (trip.peakLateral > most ? trip.peakLateral : most), 0)
	);
	const moving = $derived(stats.trips.reduce((sum, trip) => sum + trip.movingSeconds, 0));
	const above100 = $derived(stats.speed.secondsAbove.find((s) => s.speed === 100)?.seconds ?? 0);
	const signals = $derived([...dataset.columns.values()].filter((c) => c.nonNull > 0).length);
	const doors = $derived(stats.doors);
	const tyres = $derived(stats.tyres);

	/**
	 * How much of the driving combined real braking or acceleration with real
	 * cornering: the corners of the g-g diagram. A careful driver's fills a
	 * cross and leaves them nearly empty.
	 */
	const COMBINED_G = 0.2;
	const combined = $derived.by(() => {
		const { grid, size, extent, total } = stats.gg;
		if (total === 0) return NaN;
		const g = (index: number) => ((index + 0.5) / size) * 2 * extent - extent;
		let count = 0;
		for (let lateral = 0; lateral < size; lateral++) {
			if (Math.abs(g(lateral)) < COMBINED_G) continue;
			for (let longitudinal = 0; longitudinal < size; longitudinal++) {
				if (Math.abs(g(longitudinal)) >= COMBINED_G) count += grid[lateral * size + longitudinal];
			}
		}
		return count / total;
	});
	const gentle = $derived(Number.isFinite(combined) && combined < 0.01);

	/** The observations a reader would not have asked for, each a way into its page. */
	const asides = $derived(
		[...stats.facts.habit, ...stats.facts.quirk].filter((f) => f.href).slice(0, 6)
	);
</script>

<div class="mx-auto max-w-6xl space-y-10">
	{#if stats.facts.privacy.length}
		<section
			aria-labelledby="knows"
			class="flex flex-wrap items-center gap-6 rounded-2xl border p-6 sm:p-8"
			style="background: radial-gradient(100% 180% at 0% 0%, color-mix(in oklab, var(--viz-5) 22%, transparent), transparent 55%), var(--card)"
		>
			<div class="min-w-64 flex-1 space-y-2">
				<p class="flex items-center gap-2 eyebrow"><ShieldIcon class="size-4" /> Privacy</p>
				<h2 id="knows" class="text-3xl font-bold tracking-tight">What this file knows about you</h2>
				<p class="text-muted-foreground">
					Not a single map coordinate, and it still gives away your routine.
				</p>
			</div>
			<ul class="grid min-w-72 flex-[2] gap-3 sm:grid-cols-3">
				{#each stats.facts.privacy.slice(0, 3) as fact (fact.id)}
					<li class="rounded-xl bg-background/70 p-4">
						<p class="text-sm font-semibold">{fact.kicker}</p>
						<p
							class="mt-1 text-2xl font-bold tracking-tight tabular-nums"
							style="color: var(--viz-5)"
						>
							{fact.value}{#if fact.unit}<span
									class="ml-1 text-sm font-medium text-muted-foreground">{fact.unit}</span
								>{/if}
						</p>
					</li>
				{/each}
			</ul>
			<a
				href="/dash/privacy"
				class="{buttonVariants()} bg-[var(--viz-5)] text-[#0a0a0c] hover:bg-[color-mix(in_oklab,var(--viz-5)_85%,white)]"
			>
				Read the full account
				<ArrowRightIcon class="size-4" />
			</a>
		</section>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="lg:row-span-2">
			<Card.Header>
				<p class="eyebrow">Driving style · how much grip you used</p>
				<Card.Title class="text-xl leading-snug font-bold">
					{gentle
						? 'A narrow cross: you rarely brake and steer hard at the same time'
						: 'You often brake or accelerate while cornering'}
				</Card.Title>
				{#if Number.isFinite(combined)}
					<Card.Description>
						{percent(combined, 1)} of your driving combined more than {COMBINED_G} g of cornering with
						braking or acceleration.
					</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="mx-auto max-w-sm">
					<GgDiagram
						grid={stats.gg.grid}
						size={stats.gg.size}
						extent={stats.gg.extent}
						max={stats.gg.max}
						total={stats.gg.total}
						height={300}
					/>
				</div>
				<dl class="grid grid-cols-3 gap-4 border-t pt-5">
					<div>
						<dt class="eyebrow">Hardest stop</dt>
						<dd class="text-2xl font-bold tabular-nums" style="color: var(--viz-brake)">
							{num(hardestStop, 2)} g
						</dd>
					</div>
					<div>
						<dt class="eyebrow">Hardest launch</dt>
						<dd class="text-2xl font-bold tabular-nums" style="color: var(--viz-3)">
							{num(hardestLaunch, 2)} g
						</dd>
					</div>
					<div>
						<dt class="eyebrow">Hardest corner</dt>
						<dd class="text-2xl font-bold tabular-nums" style="color: var(--viz-7)">
							{num(hardestCorner, 2)} g
						</dd>
					</div>
				</dl>
				<a href="/dash/driving" class={buttonVariants({ variant: 'outline' })}>
					Driving style in full
					<ArrowRightIcon class="size-4" />
				</a>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<p class="eyebrow">Speeds you drive</p>
				<Card.Title class="text-xl leading-snug font-bold">
					Top speed {num(stats.speed.maxSpeed)} km/h, above 100 for {duration(above100, 'short')}
				</Card.Title>
				<Card.Description>Of {duration(moving, 'short')} spent moving.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Histogram
					edges={stats.speed.histogram.edges}
					counts={stats.speed.histogram.counts}
					unit="km/h"
					accent="--viz-speed"
					height={130}
					countsAreSeconds
					label="Speed while moving"
				/>
			</Card.Content>
		</Card.Root>

		<a href="/dash/doors-tyres" class="group block">
			<Card.Root class="h-full transition-colors group-hover:border-foreground/20">
				<Card.Header>
					<p class="eyebrow">Doors & tyres</p>
					<Card.Title class="text-xl leading-snug font-bold">
						{#if doors.busiestHourCount > 0}
							Doors open most around {hourLabel(
								doors.busiestHour
							)}{#if doors.quietStretch && doors.quietStretch.hours >= 3}, and never between {hourLabel(
									doors.quietStretch.from
								)} and {hourLabel(doors.quietStretch.to)}{/if}
						{:else}
							Door and tyre readings, day by day
						{/if}
					</Card.Title>
					{#if Number.isFinite(tyres.minPressure)}
						<Card.Description>
							Tyres between {num(tyres.minPressure)} and {num(tyres.maxPressure)} kPa over the period.
						</Card.Description>
					{/if}
				</Card.Header>
				<Card.Content>
					<span class="inline-flex items-center gap-1 text-sm font-medium">
						See the week as the doors saw it
						<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
					</span>
				</Card.Content>
			</Card.Root>
		</a>
	</div>

	<section aria-labelledby="asides" class="space-y-4">
		<h2 id="asides" class="text-lg font-semibold tracking-tight">
			{asides.length ? 'Things you would not have asked' : 'Go further'}
		</h2>
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each asides as fact (fact.id)}
				<li>
					<a
						href={fact.href}
						class="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
					>
						<span class="eyebrow">{fact.kicker}</span>
						<span class="text-xl font-bold tabular-nums">
							{fact.value}{#if fact.unit}<span
									class="ml-1 text-sm font-medium text-muted-foreground">{fact.unit}</span
								>{/if}
						</span>
						<span class="line-clamp-2 text-sm text-muted-foreground">{fact.detail}</span>
					</a>
				</li>
			{/each}
			<li>
				<a
					href="/dash/explorer"
					class="group flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
					style="background: radial-gradient(120% 120% at 100% 0%, color-mix(in oklab, var(--viz-7) 14%, transparent), transparent 60%), var(--card)"
				>
					<span class="eyebrow">Signal explorer</span>
					<span class="text-xl font-bold">Plot any of the {num(signals)} raw signals</span>
					<span class="mt-auto inline-flex items-center gap-1 text-sm font-medium">
						Open the explorer
						<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
					</span>
				</a>
			</li>
		</ul>
	</section>
</div>
