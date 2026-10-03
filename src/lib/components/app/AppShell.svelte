<!--
  The frame every in-app page sits in: the sidebar, the sticky bar with the
  page's title and its own controls, and the tab bar on phones.

  The leaderboard uses it too, so going there from the dashboard is a step
  inside the app rather than a jump to another site. Somebody who arrives with
  no car open sees the community side and a way to open their own export.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import MadeBy from './MadeBy.svelte';
	import RecordBox from './RecordBox.svelte';
	import LogoMark from './LogoMark.svelte';
	import SectionTabs from './SectionTabs.svelte';
	import MobileTabBar from './MobileTabBar.svelte';
	import { CAR_AREAS, DATA, LEADERBOARD, areaFor } from '#lib/navigation.js';
	import { SITE_NAME } from '#lib/seo.js';
	import { data, hasRecord } from '#lib/state/dataset.svelte.js';
	import { logbook } from '#lib/state/logbook.svelte.js';
	import PlayIcon from '@lucide/svelte/icons/play';
	import UploadIcon from '@lucide/svelte/icons/upload';

	interface Props {
		title: string;
		/** Beside the title: a status chip or similar. */
		badge?: Snippet;
		/** The right of the bar: the page's own controls. */
		actions?: Snippet;
		children: Snippet;
	}

	let { title, badge, actions, children }: Props = $props();

	const area = $derived(areaFor(page.url.pathname));
	const active = $derived(
		area?.id ?? (page.url.pathname.startsWith(LEADERBOARD.href) ? LEADERBOARD.id : null)
	);
	const shared = $derived(data.source.kind === 'shared');
	const unlabelled = $derived(!shared && logbook.loaded ? logbook.record.unlabelled : 0);

	/** A car's pages are offered when one is open, or a dashboard here can reopen one. */
	let remembered = $state(false);
	$effect(() => {
		remembered = hasRecord();
	});
	const withCar = $derived(data.isReady || remembered);
</script>

{#snippet navLink(href: string, label: string, Icon: typeof PlayIcon, current: boolean, count = 0)}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton isActive={current} tooltipContent={label} class="h-10 text-[15px]">
			{#snippet child({ props })}
				<a {href} {...props} aria-current={current ? 'page' : undefined}>
					<Icon />
					<span>{label}</span>
				</a>
			{/snippet}
		</Sidebar.MenuButton>
		{#if count > 0}
			<Sidebar.MenuBadge
				class="rounded-full bg-[color-mix(in_oklab,var(--viz-2)_22%,transparent)] px-2 text-[var(--viz-2)]"
				aria-label="{count} trips without a place"
			>
				{count}
			</Sidebar.MenuBadge>
		{/if}
	</Sidebar.MenuItem>
{/snippet}

<Sidebar.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header class="gap-4 px-3 pt-5">
			<a
				href="/"
				class="flex items-center gap-2.5 rounded-lg px-1 text-[17px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				aria-label="{SITE_NAME} — back to the start"
			>
				<LogoMark size={30} />
				<span class="group-data-[collapsible=icon]:hidden">{SITE_NAME}</span>
			</a>
			{#if data.isReady}
				<div class="group-data-[collapsible=icon]:hidden">
					<RecordBox />
				</div>
			{/if}
		</Sidebar.Header>

		<Sidebar.Content class="px-1">
			<Sidebar.Group>
				<Sidebar.GroupLabel class="eyebrow">Your car</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu class="gap-0.5">
						{#if withCar}
							{#each CAR_AREAS as item (item.id)}
								{@render navLink(
									item.href,
									item.label,
									item.icon,
									active === item.id,
									item.id === 'trips' ? unlabelled : 0
								)}
							{/each}
						{:else}
							{@render navLink('/', 'Open your export', UploadIcon, false)}
						{/if}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Group>
				<Sidebar.GroupLabel class="eyebrow">Community</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{@render navLink(
							LEADERBOARD.href,
							LEADERBOARD.label,
							LEADERBOARD.icon,
							active === LEADERBOARD.id
						)}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer class="gap-3 px-2 pb-4">
			{#if withCar}
				<Sidebar.Menu class="gap-0.5 border-t border-sidebar-border pt-3">
					{@render navLink(DATA.href, DATA.label, DATA.icon, active === DATA.id)}
					{@render navLink('/wrapped', 'Replay the highlights', PlayIcon, false)}
				</Sidebar.Menu>
			{/if}
			<div class="space-y-1 px-2 group-data-[collapsible=icon]:hidden">
				<MadeBy />
				<p class="text-xs text-muted-foreground">
					<a href="/legal/imprint" class="hover:text-foreground">Imprint</a>
					·
					<a href="/legal/privacy" class="hover:text-foreground">Privacy</a>
				</p>
			</div>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset>
		<header
			class="sticky top-0 z-10 border-b bg-background/80 px-4 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-10"
		>
			<div class="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3">
				<Sidebar.Trigger class="-ml-1" />
				<h1 class="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</h1>
				{@render badge?.()}
				<span class="mr-auto"></span>
				{@render actions?.()}
			</div>
			<SectionTabs />
		</header>
		<main class="flex-1 px-4 pt-8 sm:px-6 lg:px-10 {withCar ? 'pb-28 md:pb-16' : 'pb-16'}">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
{#if withCar}
	<MobileTabBar />
{/if}
