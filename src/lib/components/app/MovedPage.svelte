<!--
  What a superseded deployment shows in place of every page.

  Set `PUBLIC_MOVED_TO` on a Worker and the app there shrinks to this: a loud
  pointer at the new address, and a backup of the exports kept in this browser
  — stored per origin, so invisible from the new one — to drop in there.
  Nothing else is reachable, so nobody keeps using the old copy by accident.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import LogoMark from '#lib/components/app/LogoMark.svelte';
	import LocaleSwitch from '#lib/components/app/LocaleSwitch.svelte';
	import Seo from '#lib/components/app/Seo.svelte';
	import { history } from '#lib/state/history.svelte.js';
	import { bytes } from '#lib/utils/format.js';
	import { MOVED_TO, SITE_NAME } from '#lib/seo.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import DownloadIcon from '@lucide/svelte/icons/download';

	/** The address as people would say it, without the scheme. */
	const host = MOVED_TO.replace(/^https?:\/\//, '');

	/** The demo is in every browser already; only real exports are worth carrying. */
	const kept = $derived(history.entries.filter((entry) => !entry.isDemo));
	const size = $derived(kept.reduce((sum, entry) => sum + entry.storedBytes, 0));

	onMount(() => {
		void history.refresh();
	});

	async function backup() {
		try {
			await history.backup(kept.map((entry) => entry.id));
		} catch (error) {
			toast(m.moved.backupFailed, {
				description: error instanceof Error ? error.message : m.moved.somethingWrong,
				closeButton: true
			});
		}
	}
</script>

<Seo noindex canonicalUrl={MOVED_TO} />

<main class="relative flex min-h-svh flex-col overflow-hidden">
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
		style="background: radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--viz-1) 24%, transparent), transparent 70%)"
		aria-hidden="true"
	></div>

	<nav class="relative flex items-center gap-2 px-4 py-5 sm:px-8 lg:px-12">
		<span class="mr-auto flex items-center gap-2.5 text-lg font-semibold tracking-tight">
			<LogoMark size={32} />
			{SITE_NAME}
		</span>
		<LocaleSwitch />
	</nav>

	<div class="relative mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-8 lg:pt-16">
		<header class="text-center">
			<p class="text-sm font-medium tracking-wide uppercase" style="color: var(--viz-3)">
				{m.moved.eyebrow}
			</p>
			<h1
				class="mt-4 text-4xl leading-[1.05] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl"
			>
				{m.moved.title(SITE_NAME)}
				<span
					class="block bg-clip-text pb-1 text-transparent"
					style="background-image: linear-gradient(100deg, var(--viz-1), var(--viz-3))">{host}</span
				>
			</h1>
			<p class="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
				{m.moved.lede}
			</p>
			<Button href={MOVED_TO} size="lg" class="mt-8 h-14 px-8 text-lg">
				{m.moved.open(host)}
				<ArrowRightIcon class="size-5" />
			</Button>
		</header>

		<section class="mt-16 rounded-xl border bg-card p-6 sm:p-8">
			<h2 class="text-xl font-semibold tracking-tight">{m.moved.carryTitle}</h2>
			<p class="mt-1 text-sm text-muted-foreground">{m.moved.carryIntro}</p>

			<ol class="mt-6 grid gap-4 sm:grid-cols-3">
				{#each m.moved.steps(host) as step, index (index)}
					<li class="flex gap-3">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
							>{index + 1}</span
						>
						<div class="text-sm">
							<p class="font-medium">{step.title}</p>
							<p class="text-muted-foreground">{step.detail}</p>
						</div>
					</li>
				{/each}
			</ol>

			<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-6">
				{#if kept.length > 0}
					<Button size="lg" disabled={history.busy} onclick={backup}>
						<DownloadIcon class="size-4" />
						{m.moved.backUp}
					</Button>
					<p class="text-sm text-muted-foreground">{m.moved.kept(kept.length, bytes(size))}</p>
				{:else if history.status === 'unavailable'}
					<p class="text-sm text-muted-foreground">{m.moved.unavailable}</p>
				{:else if history.status === 'ready'}
					<p class="text-sm text-muted-foreground">{m.moved.notKept}</p>
				{/if}
			</div>
		</section>
	</div>
</main>
