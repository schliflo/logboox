<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import DropZone from '#lib/components/app/DropZone.svelte';
	import ExportLibrary from '#lib/components/app/ExportLibrary.svelte';
	import ParseProgress from '#lib/components/app/ParseProgress.svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import FeatureTeasers from '#lib/components/app/FeatureTeasers.svelte';
	import SiteHeader from '#lib/components/app/SiteHeader.svelte';
	import SiteFooter from '#lib/components/app/SiteFooter.svelte';
	import Seo from '#lib/components/app/Seo.svelte';
	import { onMount } from 'svelte';
	import { data, recordIds } from '#lib/state/dataset.svelte.js';
	import { history } from '#lib/state/history.svelte.js';
	import { dateOnly, num } from '#lib/utils/format.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';
	import AlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import PlayIcon from '@lucide/svelte/icons/play';

	onMount(() => {
		void history.refresh();
	});

	/**
	 * The record that "Open my dashboard" opens, exactly: the same exports, so
	 * the greeting never promises more than will appear. Days are counted over
	 * the union of their windows, because neighbouring exports overlap.
	 */
	const record = $derived.by(() => {
		const ids = new Set(recordIds());
		const mine = history.entries.filter((entry) => ids.has(entry.id));
		if (mine.length === 0) return null;
		const spans = mine.map((entry) => [entry.startTime, entry.endTime]).sort((a, b) => a[0] - b[0]);
		let seconds = 0;
		let reach = -Infinity;
		for (const [from, to] of spans) {
			const start = Math.max(from, reach);
			if (to > start) seconds += to - start;
			reach = Math.max(reach, to);
		}
		return {
			demo: mine[0].isDemo,
			from: spans[0][0],
			to: Math.max(...mine.map((entry) => entry.endTime)),
			days: Math.max(1, Math.round(seconds / 86_400))
		};
	});

	const steps = $derived(m.landing.steps);
</script>

<Seo />

<main class="relative flex min-h-svh flex-col overflow-hidden">
	<!-- A quiet field of light behind the fold, so the page has depth without noise. -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
		style="background: radial-gradient(60% 100% at 30% 0%, color-mix(in oklab, var(--viz-1) 20%, transparent), transparent 70%)"
		aria-hidden="true"
	></div>

	<SiteHeader>
		<a
			href="#getting-your-export"
			class="{buttonVariants({ variant: 'ghost' })} font-semibold max-lg:!hidden"
		>
			{m.landing.howTo}
		</a>
	</SiteHeader>

	<div class="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-8 lg:pt-10">
		{#if data.status === 'loading'}
			<div class="flex min-h-[60svh] items-center justify-center">
				<ParseProgress />
			</div>
		{:else}
			<div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21.5rem] lg:gap-12">
				<div class="min-w-0">
					<header>
						<p class="flex items-center gap-2 text-sm font-medium" style="color: var(--viz-3)">
							<ShieldIcon class="size-4" />
							{m.landing.promise}
						</p>
						<h1 class="mt-4 text-5xl leading-[0.95] font-extrabold tracking-[-0.045em] sm:text-7xl">
							{m.landing.headline}
							<span
								class="block bg-clip-text pb-2 text-transparent"
								style="background-image: linear-gradient(100deg, var(--viz-1), var(--viz-3))"
								>{m.landing.headlineAccent}</span
							>
						</h1>
						<p class="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
							{m.landing.lede}
						</p>
					</header>

					<div class="mt-8">
						<DropZone />
					</div>

					{#if data.status === 'error' && data.error}
						<div
							class="mt-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left"
							role="alert"
						>
							<AlertIcon class="mt-0.5 size-5 shrink-0 text-destructive" />
							<div class="space-y-1 text-sm">
								<p class="font-medium">{data.error.message}</p>
								{#if data.error.hint}
									<p class="text-muted-foreground">{data.error.hint}</p>
								{/if}
							</div>
						</div>
					{/if}

					<div class="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
						<Button
							variant="outline"
							size="lg"
							class="h-11 px-5"
							onclick={() => data.loadDemoData()}
						>
							<PlayIcon class="size-4" />
							{m.landing.demo}
						</Button>
						<p class="text-sm text-muted-foreground">{m.landing.noExport}</p>
					</div>
				</div>

				<!-- On phones the welcome comes first: a returning reader's next step. -->
				<aside class="flex flex-col gap-5 max-lg:contents">
					{#if record}
						<section
							aria-labelledby="welcome"
							class="rounded-2xl border p-6 max-lg:order-first"
							style="background: radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, var(--viz-1) 18%, transparent), transparent 60%), var(--card)"
						>
							<h2 id="welcome" class="eyebrow">{m.landing.welcome}</h2>
							<p class="mt-4 flex items-baseline gap-2">
								<span
									class="text-5xl leading-none font-bold tracking-tight tabular-nums"
									style="color: var(--viz-1)"
								>
									{num(record.days)}
								</span>
								<span class="text-muted-foreground">{m.landing.daysRecorded(record.days)}</span>
							</p>
							<p class="mt-2 text-sm text-muted-foreground">
								{record.demo ? m.landing.demoCar : ''}{dateOnly(record.from)} – {dateOnly(
									record.to
								)}
							</p>
							<Button
								size="lg"
								class="mt-5 h-11 px-5"
								disabled={history.busy}
								onclick={() => data.openRecord()}
							>
								{m.landing.open}
								<ArrowRightIcon class="size-4" />
							</Button>
							<p class="mt-4 text-xs leading-relaxed text-muted-foreground">
								{m.landing.joinOn}
							</p>
						</section>
					{/if}

					<section
						id="getting-your-export"
						aria-labelledby="steps"
						class="scroll-mt-6 rounded-2xl border bg-card p-6"
					>
						<h2 id="steps" class="font-semibold">{m.landing.gettingExport}</h2>
						<ol class="mt-4 space-y-3.5 text-sm">
							<li class="flex gap-3">
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold"
									>1</span
								>
								<span class="leading-relaxed">
									{m.landing.requestAt}
									<a
										href="https://www.xpeng.com/data-act"
										target="_blank"
										rel="noreferrer noopener"
										class="underline underline-offset-4"
										style="color: var(--viz-1)">xpeng.com/data-act</a
									>.
								</span>
							</li>
							{#each steps as step, index (index)}
								<li class="flex gap-3">
									<span
										class="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
										>{index + 2}</span
									>
									<span class="leading-relaxed">{step}</span>
								</li>
							{/each}
						</ol>
					</section>

					{#if history.count > 0}
						<details class="group">
							<summary
								class="flex cursor-pointer list-none items-center gap-2 px-1 text-sm text-muted-foreground hover:text-foreground"
							>
								<ChevronRightIcon class="size-4 transition-transform group-open:rotate-90" />
								{m.landing.imported(history.count)}
							</summary>
							<ExportLibrary />
						</details>
					{/if}
				</aside>
			</div>

			<FeatureTeasers />

			<section class="mt-16 max-w-3xl">
				<div class="space-y-3">
					<h2 class="flex items-center gap-2 text-lg font-semibold">
						<ShieldIcon class="size-5 text-primary" />
						{m.landing.privacyTitle}
					</h2>
					<p class="text-sm leading-relaxed text-muted-foreground">
						{m.landing.privacyOne}
					</p>
					<p class="text-sm leading-relaxed text-muted-foreground">
						{m.landing.privacyTwo}
					</p>
				</div>
			</section>
		{/if}
	</div>

	<SiteFooter />
</main>
