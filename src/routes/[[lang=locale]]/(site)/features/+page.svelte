<script lang="ts">
	import { goto } from '$app/navigation';
	import { localHref, m } from '#lib/i18n/index.svelte.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import RouteIcon from '@lucide/svelte/icons/route';
	import PlugIcon from '@lucide/svelte/icons/plug-zap';
	import BatteryIcon from '@lucide/svelte/icons/battery-medium';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import DoorIcon from '@lucide/svelte/icons/door-open';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import CalendarIcon from '@lucide/svelte/icons/calendar-range';
	import PinIcon from '@lucide/svelte/icons/map-pin';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import FileIcon from '@lucide/svelte/icons/file-text';
	import DriveIcon from '@lucide/svelte/icons/hard-drive';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import OfflineIcon from '@lucide/svelte/icons/wifi-off';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import BellIcon from '@lucide/svelte/icons/bell';
	import CodeIcon from '@lucide/svelte/icons/code';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import PlayIcon from '@lucide/svelte/icons/play';

	/** One icon per item, group by group, in catalog order. */
	const ICONS = [
		[RouteIcon, PlugIcon, BatteryIcon, GaugeIcon, DoorIcon, EyeIcon, ActivityIcon, CalendarIcon],
		[PinIcon, SparklesIcon, FileIcon],
		[DriveIcon, LayersIcon, ArchiveIcon, OfflineIcon],
		[CloudIcon, BellIcon, CodeIcon, ShareIcon, TrophyIcon]
	];

	const COLORS = ['var(--viz-1)', 'var(--viz-3)', 'var(--viz-2)', 'var(--viz-4)'];

	const groups = $derived(
		m.featuresPage.groups.map((group, g) => ({
			...group,
			color: COLORS[g % COLORS.length],
			items: group.items.map((item, i) => ({ ...item, icon: ICONS[g][i] }))
		}))
	);

	/** The demo parses on the landing page, where its progress is shown. */
	async function demo() {
		await goto(localHref('/'));
		void data.loadDemoData();
	}
</script>

<Seo title={m.featuresPage.title} description={m.featuresPage.description} path="/features" />

<header class="max-w-3xl">
	<p class="eyebrow" style="color: var(--viz-3)">{m.featuresPage.eyebrow}</p>
	<h1 class="mt-4 text-4xl leading-[1] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
		{m.featuresPage.headline}
	</h1>
	<p class="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">{m.featuresPage.lede}</p>
</header>

{#each groups as group, g (g)}
	<section class="mt-16" aria-labelledby="group-{g}">
		<h2 id="group-{g}" class="text-xl font-semibold tracking-tight">{group.title}</h2>
		<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each group.items as item, i (i)}
				<article class="rounded-2xl border bg-card/50 p-5">
					<span
						class="grid size-9 place-items-center rounded-lg"
						style="color: {group.color}; background: color-mix(in oklab, {group.color} 16%, transparent)"
					>
						{#if item.icon}<item.icon class="size-[18px]" aria-hidden="true" />{/if}
					</span>
					<h3 class="mt-4 font-semibold">{item.title}</h3>
					<p class="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
						{item.body}
					</p>
				</article>
			{/each}
		</div>
	</section>
{/each}

<section
	class="mt-20 rounded-2xl border p-6 sm:p-10"
	style="background: radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, var(--viz-1) 18%, transparent), transparent 60%), var(--card)"
>
	<h2 class="text-2xl font-bold tracking-tight">{m.featuresPage.ctaTitle}</h2>
	<p class="mt-2 max-w-xl text-muted-foreground">{m.featuresPage.ctaBody}</p>
	<div class="mt-6 flex flex-wrap gap-3">
		<Button href={localHref('/')} size="lg" class="h-11 px-5">
			{m.site.readExport}
			<ArrowRightIcon class="size-4" />
		</Button>
		<Button variant="outline" size="lg" class="h-11 px-5" onclick={demo}>
			<PlayIcon class="size-4" />
			{m.landing.demo}
		</Button>
	</div>
</section>
