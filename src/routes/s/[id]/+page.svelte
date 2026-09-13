<!--
  Someone else's trip.

  Opened by a reader with no export, no account and quite possibly no idea what
  any of this is, so it says what it is before it draws anything, and ends with
  the one thing that makes it useful to them: that they can ask for their own.

  It carries the model of the car and nothing else. There is no vehicle
  identification number on this page, in its data, or in the objects behind it
  — that number identifies an owner through a registration record, and a link
  that travels is exactly the wrong place for it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import BigStat from '$lib/components/charts/BigStat.svelte';
	import TripDetail from '$lib/components/app/TripDetail.svelte';
	import SessionDetail from '$lib/components/app/SessionDetail.svelte';
	import Seo from '$lib/components/app/Seo.svelte';
	import MadeBy from '$lib/components/app/MadeBy.svelte';
	import { apiBytes } from '$lib/api/client';
	import { data as dataset } from '$lib/state/dataset.svelte';
	import { decodeSlice, type Slice, type SliceManifest } from '$lib/share/slice';
	import { TIME_BLOB } from '$lib/history/codec';
	import { duration, num, percent } from '$lib/utils/format';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const share = $derived(data.share);
	const meta = $derived(share.meta as Record<string, number | string | boolean | null>);

	let slice = $state<Slice | null>(null);
	let failure = $state<string | null>(null);

	/** The whole trip: it arrived as its own slice, so there is nothing to cut. */
	const range = $derived(slice ? { from: 0, to: slice.time.length - 1 } : null);

	const when = $derived(
		new Intl.DateTimeFormat('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: share.timeZone
		}).format(new Date(share.startTime * 1000))
	);

	const heading = $derived(
		share.title ||
			(share.kind === 'trip'
				? `A ${num(Number(meta.distanceKm ?? 0), 1)} km drive`
				: share.kind === 'charging'
					? `A ${num(Number(meta.kwhDelivered ?? 0), 1)} kWh charge`
					: 'A month of driving')
	);

	const card = $derived(
		share.kind === 'trip'
			? `${num(Number(meta.distanceKm ?? 0), 1)} km in ${duration(Number(meta.duration ?? 0), 'short')}, second by second, from an XPeng ${share.model}.`
			: share.kind === 'charging'
				? `${num(Number(meta.kwhDelivered ?? 0), 1)} kWh at up to ${num(Number(meta.maxKw ?? 0), 1)} kW, from an XPeng ${share.model}.`
				: `A month of driving from an XPeng ${share.model}.`
	);

	onMount(async () => {
		if (share.kind === 'export') return;
		try {
			const manifestBytes = await apiBytes(`/api/v1/shares/${share.id}/blobs/_manifest`);
			const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as SliceManifest;
			const names = [TIME_BLOB, ...manifest.columns.map((column) => column.key)];
			const blobs = new Map<string, ArrayBuffer>();
			await Promise.all(
				names.map(async (name) => {
					blobs.set(name, await apiBytes(`/api/v1/shares/${share.id}/blobs/${name}`));
				})
			);
			slice = decodeSlice(manifest, share.model, blobs);
		} catch (error) {
			failure = error instanceof Error ? error.message : 'The samples could not be read.';
		}
	});
</script>

<Seo
	title={heading}
	description={card}
	cardTitle={heading}
	cardDescription={card}
	canonicalUrl={data.canonical}
	noindex
/>

<main class="mx-auto min-h-svh max-w-4xl space-y-6 px-6 py-12">
	<header class="space-y-3">
		<div class="flex flex-wrap items-center gap-2">
			<Badge variant="secondary">Shared from LogbooX</Badge>
			<Badge variant="outline">XPeng {share.model}</Badge>
		</div>
		<h1 class="text-3xl font-semibold tracking-tight text-balance">{heading}</h1>
		<p class="text-sm text-muted-foreground">{when}</p>
		{#if share.description}
			<p class="text-pretty">{share.description}</p>
		{/if}
	</header>

	{#if share.kind === 'trip'}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Distance"
						value={num(Number(meta.distanceKm ?? NaN), 1)}
						unit="km"
						size="sm"
						accent="--viz-1"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Duration"
						value={duration(Number(meta.duration ?? 0), 'short')}
						size="sm"
						accent="--viz-3"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Top speed"
						value={num(Number(meta.maxSpeed ?? NaN))}
						unit="km/h"
						size="sm"
						accent="--viz-2"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Energy used"
						value={num(Number(meta.energyKwh ?? NaN), 1)}
						unit="kWh"
						size="sm"
						accent="--viz-4"
						detail={Number.isFinite(Number(meta.regenShare))
							? `${percent(Number(meta.regenShare))} came back through regeneration`
							: undefined}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	{:else if share.kind === 'charging'}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Energy delivered"
						value={num(Number(meta.kwhDelivered ?? NaN), 1)}
						unit="kWh"
						size="sm"
						accent="--viz-3"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Duration"
						value={duration(Number(meta.duration ?? 0), 'short')}
						size="sm"
						accent="--viz-1"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Peak power"
						value={num(Number(meta.maxKw ?? NaN), 1)}
						unit="kW"
						size="sm"
						accent="--viz-2"
						detail={meta.isDc ? 'Rapid DC charging' : 'Through the onboard AC charger'}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Charge added"
						value="{num(Number(meta.socStart ?? NaN))} → {num(Number(meta.socEnd ?? NaN))}"
						unit="%"
						size="sm"
						accent="--viz-4"
					/>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	{#if share.kind !== 'export'}
		<Card.Root>
			<Card.Header>
				<Card.Title>Second by second</Card.Title>
				<Card.Description>
					One sample a second, as the car recorded it. Hovering any panel reads out that instant in
					all of them.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if failure}
					<p class="text-sm text-destructive">{failure}</p>
				{:else if slice && range}
					{#if share.kind === 'trip'}
						<TripDetail source={slice} from={range.from} to={range.to} syncKey="shared" />
					{:else}
						<SessionDetail source={slice} from={range.from} to={range.to} syncKey="shared" />
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">Reading the samples…</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>A whole month</Card.Title>
				<Card.Description>
					This link carries an entire export. Opening it reads the whole thing into your browser,
					which takes a moment and a few hundred megabytes of memory.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button
					disabled={dataset.status === 'loading'}
					onclick={() => dataset.openSharedExport(share.id)}
				>
					{dataset.status === 'loading' ? 'Reading…' : 'Open the dashboard'}
					<ArrowRightIcon class="size-4" />
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root class="border-primary/30">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ShieldIcon class="size-5 text-primary" />
				Your car records this too
			</Card.Title>
			<Card.Description>
				Under the EU Data Act you can ask XPeng for the data your own vehicle keeps. LogbooX reads
				it in your browser — there is nothing to upload, and nothing to sign up for.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button href="/">
				Read your own export
				<ArrowRightIcon class="size-4" />
			</Button>
		</Card.Content>
	</Card.Root>

	<footer class="flex justify-center pt-4">
		<MadeBy />
	</footer>
</main>
