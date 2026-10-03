<!--
  The time range, as buttons rather than a menu.

  The ranges people reach for — the last week, month or quarter, and
  everything — sit in plain view, one click each and visibly on or off.
  Calendar months, years and exact dates stay one step away under "More".
  Only the presets the record is long enough for are offered.
-->
<script lang="ts">
	import RangeFilter from '#lib/components/app/RangeFilter.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { rangePresets, type TimeRange } from '#lib/data/range.js';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';

	const SHORT: Record<string, string> = {
		'last-7': '7 days',
		'last-30': '30 days',
		'last-90': '90 days'
	};

	const loaded = $derived(data.full?.derived ?? null);
	const quick = $derived(
		loaded ? rangePresets(loaded, settings.timeZone).filter((p) => p.preset in SHORT) : []
	);
	const active = $derived(data.range?.preset ?? null);

	function pick(range: TimeRange | null) {
		void data.setRange(range);
	}
</script>

<div class="flex items-center gap-1">
	<div
		class="flex items-center gap-0.5 rounded-xl bg-muted p-[3px]"
		role="group"
		aria-label="Time range"
		aria-busy={data.refining}
	>
		{#each quick as preset (preset.preset)}
			<button
				type="button"
				class="h-8 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:px-3"
				aria-pressed={active === preset.preset}
				onclick={() => pick(preset)}
			>
				{SHORT[preset.preset]}
			</button>
		{/each}
		<button
			type="button"
			class="h-8 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:px-3"
			aria-pressed={active === null}
			onclick={() => pick(null)}
		>
			All
		</button>
	</div>
	{#if data.refining}
		<LoaderIcon class="size-4 animate-spin text-muted-foreground" aria-label="Updating" />
	{/if}
	<RangeFilter quick={quick.map((p) => p.preset)} />
</div>
