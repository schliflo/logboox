<!--
  Narrowing the dashboard to a stretch of time.

  An export opens on its last thirty days (or seven), so a narrowed view is
  the usual case and "Everything" is one pick away. The choices are worked out
  from the export as loaded, not from what is on screen, so picking a week
  does not make the other weeks disappear from the list. The trigger looks
  different whenever the view is less than everything, and names the range at
  every width, truncated on a phone: a narrowed view mistaken for the whole
  export would make every total on the page quietly wrong. Showing everything
  needs no name, so there it is the icon alone on a phone.

  Picking only changes the view. What is kept in this browser, copied to an
  account or shared is always the whole export.
-->
<script lang="ts">
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import {
		customRange,
		EVERYTHING,
		rangeDays,
		rangePresets,
		recordedSpan,
		type TimeRange
	} from '#lib/data/range.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar-range';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import CheckIcon from '@lucide/svelte/icons/check';

	interface Props {
		/**
		 * Presets already offered as buttons beside this one. When one of them
		 * is on, the trigger stays a plain "More" rather than repeating it.
		 */
		quick?: string[];
	}

	let { quick = [] }: Props = $props();

	let open = $state(false);
	let fromDay = $state('');
	let toDay = $state('');

	const loaded = $derived(data.full?.derived ?? null);
	const presets = $derived(loaded ? rangePresets(loaded, settings.timeZone) : []);
	const span = $derived(loaded ? recordedSpan(loaded, settings.timeZone) : null);
	const label = $derived(data.range?.label ?? EVERYTHING);
	const active = $derived(data.range?.preset ?? null);
	/** True when what is on screen was picked here rather than from a quick button. */
	const elsewhere = $derived(data.range !== null && !quick.includes(data.range.preset));
	const custom = $derived(loaded ? customRange(loaded, fromDay, toDay, settings.timeZone) : null);

	const groups = $derived(
		[
			{ title: 'Recent', items: presets.filter((p) => p.preset.startsWith('last-')) },
			{ title: 'Months', items: presets.filter((p) => p.preset.startsWith('month-')) },
			{ title: 'Years', items: presets.filter((p) => p.preset.startsWith('year-')) }
		].filter((group) => group.items.length > 0)
	);

	/** The date fields start from whatever is on screen. */
	function prefill() {
		const days = data.range ? rangeDays(data.range, settings.timeZone) : span;
		fromDay = days?.first ?? '';
		toDay = days?.last ?? '';
	}

	function pick(range: TimeRange | null) {
		open = false;
		void data.setRange(range);
	}

	function apply(event: SubmitEvent) {
		event.preventDefault();
		if (custom) pick(custom);
	}
</script>

{#snippet choice(text: string, selected: boolean, onclick: () => void)}
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:font-medium"
		aria-pressed={selected}
		{onclick}
	>
		{text}
		{#if selected}
			<CheckIcon class="size-4 text-muted-foreground" />
		{/if}
	</button>
{/snippet}

<Popover.Root
	bind:open
	onOpenChange={(next) => {
		if (next) prefill();
	}}
>
	<Popover.Trigger
		class={buttonVariants({ variant: elsewhere ? 'secondary' : 'ghost', size: 'sm' })}
		aria-label={quick.length && !elsewhere ? 'More time ranges' : `Time range: ${label}`}
		aria-busy={data.refining}
	>
		{#if data.refining}
			<LoaderIcon class="size-4 animate-spin" />
		{:else}
			<CalendarIcon class="size-4" />
		{/if}
		{#if quick.length && !elsewhere}
			<span class="hidden sm:inline">More</span>
		{:else}
			<span
				class={[
					'truncate',
					data.range ? 'max-w-[11ch] sm:max-w-[18ch]' : 'hidden max-w-[18ch] sm:inline'
				]}
			>
				{label}
			</span>
		{/if}
	</Popover.Trigger>
	<Popover.Content class="w-72 gap-3" align="end">
		{#if data.range}
			<div class="space-y-2">
				<p class="text-xs text-muted-foreground">
					Showing {data.range.label} only. Totals and charts cover this range, not the whole export.
				</p>
				<Button variant="outline" size="sm" class="w-full" onclick={() => pick(null)}>
					Show everything
				</Button>
			</div>
		{/if}

		<div class="max-h-64 space-y-2 overflow-y-auto" role="group" aria-label="Time range">
			{@render choice(EVERYTHING, active === null, () => pick(null))}
			{#each groups as group (group.title)}
				<div role="group" aria-labelledby="range-{group.title}">
					<p id="range-{group.title}" class="px-2 pt-1 text-xs font-medium text-muted-foreground">
						{group.title}
					</p>
					{#each group.items as preset (preset.preset)}
						{@render choice(preset.label, active === preset.preset, () => pick(preset))}
					{/each}
				</div>
			{/each}
		</div>

		<form class="space-y-2 border-t pt-3" onsubmit={apply}>
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1">
					<Label for="range-from" class="text-xs">From</Label>
					<Input
						id="range-from"
						type="date"
						min={span?.first}
						max={span?.last}
						bind:value={fromDay}
					/>
				</div>
				<div class="space-y-1">
					<Label for="range-to" class="text-xs">To</Label>
					<Input id="range-to" type="date" min={span?.first} max={span?.last} bind:value={toDay} />
				</div>
			</div>
			<Button type="submit" size="sm" class="w-full" disabled={!custom}>Apply</Button>
		</form>
	</Popover.Content>
</Popover.Root>
