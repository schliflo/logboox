<script lang="ts">
	import DropZone from '#lib/components/app/DropZone.svelte';
	import ExportLibrary from '#lib/components/app/ExportLibrary.svelte';
	import ParseProgress from '#lib/components/app/ParseProgress.svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import MadeBy from '#lib/components/app/MadeBy.svelte';
	import MovedNotice from '#lib/components/app/MovedNotice.svelte';
	import AccountMenu from '#lib/components/app/AccountMenu.svelte';
	import Seo from '#lib/components/app/Seo.svelte';
	import { onMount } from 'svelte';
	import LogoMark from '#lib/components/app/LogoMark.svelte';
	import { data, recordIds } from '#lib/state/dataset.svelte.js';
	import { history } from '#lib/state/history.svelte.js';
	import { dateOnly, num } from '#lib/utils/format.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import DoorIcon from '@lucide/svelte/icons/door-open';
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

	const steps = [
		'Download the ZIP when the e-mail arrives. It covers the last 30 days.',
		'Drop it here. Ask again every month to build a longer record.'
	];

	const highlights = [
		{
			icon: GaugeIcon,
			title: 'Every trip, second by second',
			body: 'Speed, pedal, steering and braking at one sample a second — enough to replay individual manoeuvres, not just journeys.'
		},
		{
			icon: ZapIcon,
			title: 'What charging really costs',
			body: 'Sessions found automatically, energy integrated from pack voltage and current, and the range your car actually believes in.'
		},
		{
			icon: DoorIcon,
			title: 'The routine you never told anyone',
			body: 'Door openings alone redraw your week: when you leave, when you return, and the days you never went out.'
		}
	];
</script>

<Seo />

<main class="relative flex min-h-svh flex-col overflow-hidden">
	<!-- A quiet field of light behind the fold, so the page has depth without noise. -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
		style="background: radial-gradient(60% 100% at 30% 0%, color-mix(in oklab, var(--viz-1) 20%, transparent), transparent 70%)"
		aria-hidden="true"
	></div>

	<nav class="relative flex items-center gap-2 px-4 py-5 sm:px-8 lg:px-12">
		<a href="/" class="mr-auto flex items-center gap-2.5 text-lg font-semibold tracking-tight">
			<LogoMark size={32} />
			LogbooX
		</a>
		<a
			href="#getting-your-export"
			class="{buttonVariants({ variant: 'ghost' })} font-semibold max-md:!hidden"
		>
			How to get your data
		</a>
		<a href="/leaderboard" class="{buttonVariants({ variant: 'ghost' })} font-semibold max-sm:px-2">
			Leaderboard
		</a>
		<AccountMenu />
	</nav>

	<div class="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-8 lg:pt-10">
		{#if data.status === 'loading'}
			<div class="flex min-h-[60svh] items-center justify-center">
				<ParseProgress />
			</div>
		{:else}
			<MovedNotice />

			<div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21.5rem] lg:gap-12">
				<div class="min-w-0">
					<header>
						<p class="flex items-center gap-2 text-sm font-medium" style="color: var(--viz-3)">
							<ShieldIcon class="size-4" />
							Nothing leaves this browser unless you ask
						</p>
						<h1 class="mt-4 text-5xl leading-[0.95] font-extrabold tracking-[-0.045em] sm:text-7xl">
							Your car has been keeping
							<span
								class="block bg-clip-text pb-2 text-transparent"
								style="background-image: linear-gradient(100deg, var(--viz-1), var(--viz-3))"
								>a very detailed diary.</span
							>
						</h1>
						<p class="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
							Drop in the export XPeng sends under the EU Data Act. You get your trips, charging,
							battery and a ready-to-file logbook.
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
							Try it with a demo month
						</Button>
						<p class="text-sm text-muted-foreground">No export yet? Requests take about a week.</p>
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
							<h2 id="welcome" class="eyebrow">Welcome back</h2>
							<p class="mt-4 flex items-baseline gap-2">
								<span
									class="text-5xl leading-none font-bold tracking-tight tabular-nums"
									style="color: var(--viz-1)"
								>
									{num(record.days)}
								</span>
								<span class="text-muted-foreground"
									>{record.days === 1 ? 'day' : 'days'} recorded</span
								>
							</p>
							<p class="mt-2 text-sm text-muted-foreground">
								{record.demo ? 'The demonstration car, ' : ''}{dateOnly(record.from)} – {dateOnly(
									record.to
								)}
							</p>
							<Button
								size="lg"
								class="mt-5 h-11 px-5"
								disabled={history.busy}
								onclick={() => data.openRecord()}
							>
								Open my dashboard
								<ArrowRightIcon class="size-4" />
							</Button>
							<p class="mt-4 text-xs leading-relaxed text-muted-foreground">
								Drop newer files in and they join on by themselves.
							</p>
						</section>
					{/if}

					<section
						id="getting-your-export"
						aria-labelledby="steps"
						class="scroll-mt-6 rounded-2xl border bg-card p-6"
					>
						<h2 id="steps" class="font-semibold">Getting your export</h2>
						<ol class="mt-4 space-y-3.5 text-sm">
							<li class="flex gap-3">
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold"
									>1</span
								>
								<span class="leading-relaxed">
									Request it at
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
								Imported files ({history.count})
							</summary>
							<ExportLibrary />
						</details>
					{/if}
				</aside>
			</div>

			<section class="mt-24 grid gap-4 sm:grid-cols-3">
				{#each highlights as item (item.title)}
					<Card.Root class="bg-card/50">
						<Card.Header>
							<item.icon class="mb-2 size-5 text-primary" />
							<Card.Title class="text-base">{item.title}</Card.Title>
						</Card.Header>
						<Card.Content>
							<p class="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
						</Card.Content>
					</Card.Root>
				{/each}
			</section>

			<section class="mt-16 max-w-3xl">
				<div class="space-y-3">
					<h2 class="flex items-center gap-2 text-lg font-semibold">
						<ShieldIcon class="size-5 text-primary" />
						Nothing leaves this tab unless you ask
					</h2>
					<p class="text-sm leading-relaxed text-muted-foreground">
						The files are read by a worker inside this page — no upload, no analytics, nothing that
						travels. What the app keeps, it keeps here: a copy goes into this browser's own storage
						so an export can be reopened without dropping the files in again, and one click removes
						it. Your vehicle identification number appears on every row of the export; here it stays
						masked unless you ask to see it.
					</p>
					<p class="text-sm leading-relaxed text-muted-foreground">
						Signing in is the one exception, and it is optional. An account can hold a copy of an
						export so it outlives this browser, and can publish a single trip if you choose to share
						one. Nothing is copied to it unless you ask for that, or switch automatic copying on.
						Deleting the account takes every byte with it.
					</p>
				</div>
			</section>
		{/if}
	</div>

	<footer
		class="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-5 text-xs text-muted-foreground sm:px-8 lg:px-12"
	>
		<MadeBy />
		<p class="mr-auto">
			Open source under the
			<a
				href="https://github.com/schliflo/logboox/blob/main/LICENSE"
				class="underline underline-offset-4 hover:text-foreground"
				target="_blank"
				rel="noreferrer noopener">MIT licence</a
			>. Not affiliated with XPeng.
		</p>
		<a href="/legal/imprint" class="underline underline-offset-4 hover:text-foreground">Imprint</a>
		<a href="/legal/privacy" class="underline underline-offset-4 hover:text-foreground">Privacy</a>
		<a href="/legal/terms" class="underline underline-offset-4 hover:text-foreground">Terms</a>
	</footer>
</main>
