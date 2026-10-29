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

  Picking changes the view; a range reaching weeks of the car's timeline that
  are kept but not open opens them, and months not loaded at all are offered.
  The view itself can be downloaded as one file, or shared (a month at most)
  as a frozen copy.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import {
		customRange,
		monthRange,
		monthsBetween,
		rangeDays,
		rangePresets,
		recordedSpan,
		type TimeRange
	} from '#lib/data/range.js';
	import { history } from '#lib/state/history.svelte.js';
	import { downloadView, openRange, shareBlocker, shareView } from '#lib/state/timeline.js';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import { rangeLabel } from '#lib/i18n/dates.js';
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
	const label = $derived(
		data.range ? rangeLabel(data.range, settings.timeZone) : m.range.everything
	);
	const active = $derived(data.range?.preset ?? null);
	/** True when what is on screen was picked here rather than from a quick button. */
	const elsewhere = $derived(data.range !== null && !quick.includes(data.range.preset));
	const custom = $derived(loaded ? customRange(loaded, fromDay, toDay, settings.timeZone) : null);

	/** Months of this car's timeline kept here or in the account but not loaded. */
	const vin = $derived(data.source.kind === 'shared' ? null : (data.full?.dataset.vin ?? null));
	const earlier = $derived.by(() => {
		if (!vin || !loaded) return [];
		const shown = new Set(monthsBetween(loaded.startTime, loaded.endTime, settings.timeZone));
		const entries = history.groups.find((group) => group.vin === vin)?.entries ?? [];
		const months = new Set(
			entries.flatMap((entry) => monthsBetween(entry.startTime, entry.endTime, settings.timeZone))
		);
		return [...months]
			.filter((month) => !shown.has(month))
			.sort()
			.reverse()
			.map((month) => monthRange(month, settings.timeZone));
	});
	const blocker = $derived(data.isReady ? shareBlocker() : '');

	const groups = $derived(
		[
			{
				id: 'recent',
				title: m.range.recent,
				items: presets.filter((p) => p.preset.startsWith('last-'))
			},
			{
				id: 'months',
				title: m.range.months,
				items: presets.filter((p) => p.preset.startsWith('month-'))
			},
			{
				id: 'years',
				title: m.range.years,
				items: presets.filter((p) => p.preset.startsWith('year-'))
			}
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
		// A range reaching weeks kept but not open (part of a month, say) opens them too.
		if (range && vin && reachesUnopened(range)) void openRange(vin, range);
		else void data.setRange(range);
	}

	function reachesUnopened(range: TimeRange): boolean {
		const opened = new Set(data.source.ids);
		return (history.groups.find((group) => group.vin === vin)?.entries ?? []).some(
			(entry) => !opened.has(entry.id) && entry.endTime >= range.from && entry.startTime < range.to
		);
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
		aria-label={quick.length && !elsewhere ? m.range.moreRanges : m.range.timeRangeIs(label)}
		aria-busy={data.refining}
	>
		{#if data.refining}
			<LoaderIcon class="size-4 animate-spin" />
		{:else}
			<CalendarIcon class="size-4" />
		{/if}
		{#if quick.length && !elsewhere}
			<span class="hidden sm:inline">{m.range.more}</span>
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
					{m.range.showingOnly(label)}
				</p>
				<Button variant="outline" size="sm" class="w-full" onclick={() => pick(null)}>
					{m.range.showEverything}
				</Button>
			</div>
		{/if}

		<div class="max-h-64 space-y-2 overflow-y-auto" role="group" aria-label={m.range.timeRange}>
			{@render choice(m.range.everything, active === null, () => pick(null))}
			{#each groups as group (group.id)}
				<div role="group" aria-labelledby="range-{group.id}">
					<p id="range-{group.id}" class="px-2 pt-1 text-xs font-medium text-muted-foreground">
						{group.title}
					</p>
					{#each group.items as preset (preset.preset)}
						{@render choice(rangeLabel(preset, settings.timeZone), active === preset.preset, () =>
							pick(preset)
						)}
					{/each}
				</div>
			{/each}
		</div>

		{#if earlier.length > 0}
			<div class="max-h-32 overflow-y-auto" role="group" aria-labelledby="range-earlier">
				<p id="range-earlier" class="px-2 pt-1 text-xs font-medium text-muted-foreground">
					{m.range.earlier}
				</p>
				{#each earlier as month (month.preset)}
					{@render choice(month.label, false, () => {
						open = false;
						void openRange(vin!, month);
					})}
				{/each}
			</div>
		{/if}

		<form class="space-y-2 border-t pt-3" onsubmit={apply}>
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1">
					<Label for="range-from" class="text-xs">{m.range.from}</Label>
					<Input
						id="range-from"
						type="date"
						min={span?.first}
						max={span?.last}
						bind:value={fromDay}
					/>
				</div>
				<div class="space-y-1">
					<Label for="range-to" class="text-xs">{m.range.to}</Label>
					<Input id="range-to" type="date" min={span?.first} max={span?.last} bind:value={toDay} />
				</div>
			</div>
			<Button type="submit" size="sm" class="w-full" disabled={!custom}>{m.range.apply}</Button>
		</form>

		<div class="space-y-2 border-t pt-3">
			<Button variant="outline" size="sm" class="w-full" onclick={() => downloadView()}>
				<DownloadIcon class="size-4" />
				{m.range.download}
			</Button>
			{#if blocker !== ''}
				<Button
					variant="outline"
					size="sm"
					class="w-full"
					disabled={blocker !== null}
					onclick={() => shareView()}
				>
					<ShareIcon class="size-4" />
					{m.range.share}
				</Button>
				{#if blocker}
					<p class="text-xs text-muted-foreground">{blocker}</p>
				{/if}
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
