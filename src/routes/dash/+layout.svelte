<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import AccountMenu from '#lib/components/app/AccountMenu.svelte';
	import RangeBar from '#lib/components/app/RangeBar.svelte';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import Seo from '#lib/components/app/Seo.svelte';
	import ParseProgress from '#lib/components/app/ParseProgress.svelte';
	import { areaFor, tabFor } from '#lib/navigation.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { logbook } from '#lib/state/logbook.svelte.js';

	let { children } = $props();

	const stats = $derived(data.derived);
	/** The export as loaded; the range control says how much of it is on screen. */
	const loaded = $derived(data.full?.derived ?? stats);
	const area = $derived(areaFor(page.url.pathname));
	const tab = $derived(tabFor(page.url.pathname));

	/** Someone else's export carries no identifier worth revealing, and no logbook. */
	const shared = $derived(data.source.kind === 'shared');

	onMount(async () => {
		// A dashboard address opened cold — a reload, a bookmark — reopens what
		// was on screen last time and stays on the page it names. Only when
		// nothing kept here can be reopened does it go back to the start.
		if (data.isReady || data.status === 'loading') return;
		const here = page.url.pathname + page.url.search;
		if (!(await data.restore(here))) goto('/');
	});

	// Notes belong to the car rather than to the export they were written
	// against, so they are read once a dataset is open and its VIN is known.
	// Loaded here rather than by the dataset store, which would make the two
	// import each other.
	// The VIN is read on its own so that narrowing the range, which swaps the
	// dataset but not the car, does not reopen the logbook.
	const vin = $derived(data.dataset?.vin);
	$effect(() => {
		// Not for a shared export: those notes belong to whoever owns the car,
		// and this reader's own logbook has nothing to say about it.
		// `open` reads the store's own state before its first await; untracked,
		// so that a failure it records there cannot re-run this and call it again.
		if (vin && data.source.kind !== 'shared') untrack(() => void logbook.open(vin));
		else untrack(() => logbook.reset());
	});
</script>

<Seo
	title={tab && area && area.tabs.length > 1
		? `${tab.label} · ${area.label}`
		: (area?.label ?? 'Dashboard')}
	path={page.url.pathname}
	description="Trips, charging, battery and driving style, read out of your own XPeng export."
	noindex
/>

{#if data.isReady && stats && loaded}
	<AppShell title={area?.label ?? 'Dashboard'}>
		{#snippet badge()}
			{#if data.isDemo}
				<Badge variant="secondary" class="hidden lg:inline-flex">Demo data</Badge>
			{:else if shared}
				<Badge variant="secondary" class="hidden lg:inline-flex">Shared with you</Badge>
			{/if}
		{/snippet}
		{#snippet actions()}
			<div class="order-last w-full overflow-x-auto sm:order-none sm:w-auto">
				<RangeBar />
			</div>
			<AccountMenu variant="ghost" />
		{/snippet}
		{@render children()}
	</AppShell>
{:else if data.status === 'loading'}
	<div class="flex min-h-svh items-center justify-center px-6">
		<ParseProgress />
	</div>
{/if}
