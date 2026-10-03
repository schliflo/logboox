<!--
  The boards, as anyone may read them.

  Every number here was worked out in the browser of the person it belongs to,
  out of a file XPeng gave them, and published because they said so. That is
  worth saying on the page rather than assuming, because a scoreboard invites
  exactly the question of where its numbers came from.
-->
<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import AccountMenu from '#lib/components/app/AccountMenu.svelte';
	import { boardById, formatValue } from '#lib/leaderboard/boards.js';
	import { monthLabel } from '#lib/leaderboard/periods.js';
	import { dateOnly, duration, num } from '#lib/utils/format.js';
	import { account } from '#lib/state/account.svelte.js';
	import { absolute } from '#lib/seo.js';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CodeIcon from '@lucide/svelte/icons/code';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import BadgeDialog from '#lib/components/app/BadgeDialog.svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import LogoMark from '#lib/components/app/LogoMark.svelte';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import BoardIcon from '#lib/components/app/BoardIcon.svelte';
	import MedalDisc from '#lib/components/app/MedalDisc.svelte';
	import {
		BOARD_GROUPS,
		METALS,
		badgePath,
		medalFor,
		type OwnBadge
	} from '#lib/leaderboard/medals.js';
	import type { BoardId } from '#lib/leaderboard/boards.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const heading = $derived(
		data.kind === 'month' ? monthLabel(data.period) : `The year ${data.period}`
	);

	/** This month, `YYYY-MM`: there is nothing to step forward to past it. */
	const thisMonth = new Date().toISOString().slice(0, 7);

	/** The period as it reads inside a sentence. */
	const when = $derived(data.kind === 'month' ? monthLabel(data.period) : data.period);

	const listings = $derived(
		data.kind === 'month'
			? data.listings
			: data.summary.boards.map((board) => ({ board: board.board, entries: board.entries }))
	);

	const empty = $derived(listings.every((listing) => listing.entries.length === 0));

	/** Each board's own colour, so a board reads the same in its tile and its figures. */
	const BOARD_COLOR: Record<string, string> = {
		'longest-drive': 'var(--viz-4)',
		'monthly-distance': 'var(--viz-1)',
		'efficient-drive': 'var(--viz-3)',
		'best-regen': 'var(--viz-7)',
		'peak-charge': 'var(--viz-4)',
		'biggest-charge': 'var(--viz-2)',
		'hardest-launch': 'var(--viz-8)',
		'most-grip': 'var(--viz-5)'
	};

	function listingFor(board: string) {
		return listings.find((listing) => listing.board === board) ?? { board, entries: [] };
	}

	/**
	 * The board in focus: the one the address names, else the first that has
	 * anybody on it. A link to one board stays a link to that board.
	 */
	const focus = $derived.by<BoardId>(() => {
		const asked = page.url.searchParams.get('board');
		const order = BOARD_GROUPS.flatMap((group) => group.boards);
		if (asked && order.includes(asked as BoardId)) return asked as BoardId;
		return order.find((id) => listingFor(id).entries.length > 0) ?? order[0];
	});
	const featured = $derived(listingFor(focus));
	const podium = $derived(featured.entries.filter((entry) => entry.rank <= 3).slice(0, 3));
	const rest = $derived(featured.entries.filter((entry) => !podium.includes(entry)));
	/** Second, first, third: the winner stands in the middle. */
	const podiumOrder = $derived(
		[podium[1], podium[0], podium[2]].filter((entry): entry is (typeof podium)[number] => !!entry)
	);

	/** The reader's own places this period, on any board. */
	const mine = $derived(
		listings.flatMap((listing) =>
			listing.entries
				.filter((entry) => entry.mine)
				.map((entry) => ({ board: listing.board, entry }))
		)
	);
	/** Medals only once the period has stopped moving; until then a place is a place. */
	const medals = $derived(data.open ? [] : mine.filter((place) => medalFor(place.entry.rank)));
	const places = $derived(mine.filter((place) => !medals.includes(place)));

	/**
	 * A place the reader could take on the board in focus but has not: shown
	 * where it would stand, with what it trails and a way to take it.
	 */
	const unlisted = $derived.by(() => {
		if (data.kind !== 'month' || !data.open || mine.some((place) => place.board === focus)) {
			return null;
		}
		const offers = account.leaderboard.pending.filter(
			(candidate) => candidate.board === focus && candidate.month === data.period
		);
		const offer = offers.sort((a, b) => a.rank - b.rank)[0];
		const board = boardById(focus);
		if (!offer || !board) return null;
		// Where it would stand now, not where it stood when it was found.
		const better = featured.entries.filter((entry) =>
			board.lowerIsBetter ? entry.value < offer.value : entry.value > offer.value
		).length;
		return { ...offer, rank: better + 1 };
	});
	const ahead = $derived(
		unlisted ? featured.entries.filter((entry) => entry.rank < unlisted.rank).at(-1) : undefined
	);
	const behind = $derived.by(() => {
		const board = boardById(focus);
		if (!unlisted || !ahead || !board) return '';
		return `${formatValue(board, Math.abs(ahead.value - unlisted.value))} ${board.unit} behind #${ahead.rank}`;
	});
	let claiming = $state(false);

	async function claim() {
		if (!unlisted) return;
		claiming = true;
		try {
			const { rank } = await account.claim(unlisted.id);
			toast(`Listed at #${rank}`);
		} catch (error) {
			toast('Could not list it', { description: (error as Error).message });
		} finally {
			claiming = false;
		}
	}

	let width = $state(1024);
	const narrow = $derived(width < 640);

	let badgeOpen = $state(false);
	let shownBadge = $state<OwnBadge | null>(null);

	function reading(boardId: string, value: number): string {
		const board = boardById(boardId);
		return board ? `${formatValue(board, value)}` : String(value);
	}

	function unitOf(boardId: string): string {
		return boardById(boardId)?.unit ?? '';
	}

	function describe(boardId: string): string {
		return boardById(boardId)?.blurb ?? '';
	}

	function labelOf(boardId: string): string {
		return boardById(boardId)?.label ?? boardId;
	}

	/**
	 * The numbers beside a place: what the figure above does not already say.
	 *
	 * A board's own metric is left out of its own detail line, so the efficiency
	 * board does not print the same consumption twice.
	 */
	function extras(boardId: string, detail: Record<string, number | boolean | null>): string {
		const parts: string[] = [];
		if (typeof detail.durationSeconds === 'number' && detail.durationSeconds > 0) {
			parts.push(duration(detail.durationSeconds));
		}
		// A month says how it was made up, which a single trip has no need to.
		if (typeof detail.trips === 'number') {
			parts.push(`${num(detail.trips, 0)} ${detail.trips === 1 ? 'trip' : 'trips'}`);
		}
		if (typeof detail.longestKm === 'number' && detail.longestKm > 0) {
			parts.push(`longest ${num(detail.longestKm, 0)} km`);
		}
		if (boardId !== 'longest-drive' && typeof detail.distanceKm === 'number') {
			parts.push(`${num(detail.distanceKm, 0)} km`);
		}
		if (boardId !== 'biggest-charge' && typeof detail.kwhDelivered === 'number') {
			parts.push(`${num(detail.kwhDelivered, 1)} kWh`);
		}
		if (boardId !== 'peak-charge' && typeof detail.maxKw === 'number') {
			parts.push(`${num(detail.maxKw, 0)} kW`);
		}
		if (typeof detail.socStart === 'number' && typeof detail.socEnd === 'number') {
			parts.push(`${num(detail.socStart, 0)}% → ${num(detail.socEnd, 0)}%`);
		}
		if (boardId !== 'efficient-drive' && typeof detail.consumption === 'number') {
			parts.push(`${num(detail.consumption, 1)} kWh/100 km`);
		}
		return parts.join(' · ');
	}
</script>

<Seo
	title="Leaderboard · {heading}"
	description="What XPeng drivers have put their name to in {when}: the fastest charge, the longest drive, the most efficient run."
	path="/leaderboard/{data.period}"
	image={absolute(`/leaderboard/${data.period}/og.png`) ?? undefined}
	imageAlt="The names and figures leading the LogbooX boards for {heading}."
/>

<svelte:window bind:innerWidth={width} />

{#snippet you(offer: NonNullable<typeof unlisted>)}
	<li
		class="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 bg-[color-mix(in_oklab,var(--viz-1)_14%,transparent)] px-4 py-3 shadow-[inset_3px_0_0_var(--viz-1)] sm:gap-x-4 sm:px-8"
	>
		<span class="w-7 font-bold text-muted-foreground tabular-nums">{offer.rank}</span>
		<span class="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
			<span class="text-[15px] font-semibold">You · not listed yet</span>
			<span class="truncate text-xs text-muted-foreground">{extras(focus, offer.detail)}</span>
		</span>
		{#if behind}
			<span class="text-xs tabular-nums" style="color: color-mix(in oklab, var(--viz-1) 70%, white)"
				>{behind}</span
			>
		{/if}
		<span class="shrink-0 text-right text-lg font-bold whitespace-nowrap tabular-nums sm:min-w-24">
			{reading(focus, offer.value)}
			<span class="text-[13px] font-medium text-muted-foreground">{unitOf(focus)}</span>
		</span>
		{#if account.user?.username}
			<Button onclick={claim} disabled={claiming} class="max-sm:w-full">Put my name on it</Button>
		{:else}
			<Button href="/account#leaderboard" class="max-sm:w-full">Pick a name first</Button>
		{/if}
	</li>
{/snippet}

<AppShell title="Leaderboard">
	{#snippet badge()}
		{#if data.open}
			<span class="chip self-center" style="--chip: var(--viz-4)"
				><span class="max-sm:hidden">Open until {dateOnly(data.locksAt)}</span><span
					class="sm:hidden">Open</span
				></span
			>
		{:else}
			<span class="chip self-center" style="--chip: var(--muted-foreground)">Final</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		<nav
			aria-label="Period"
			class="order-last flex w-full items-center justify-between gap-3 sm:order-none sm:w-auto"
		>
			<span class="flex items-center gap-1">
				<Button
					href="/leaderboard/{data.previous}"
					variant="ghost"
					size="icon"
					aria-label={data.kind === 'month' ? monthLabel(data.previous) : data.previous}
				>
					<ChevronLeftIcon class="size-4" />
				</Button>
				<span class="min-w-28 text-center text-[15px] font-semibold tabular-nums">{when}</span>
				{#if data.next > (data.kind === 'month' ? thisMonth : thisMonth.slice(0, 4))}
					<Button variant="ghost" size="icon" disabled aria-label="Nothing later yet">
						<ChevronRightIcon class="size-4" />
					</Button>
				{:else}
					<Button
						href="/leaderboard/{data.next}"
						variant="ghost"
						size="icon"
						aria-label={data.kind === 'month' ? monthLabel(data.next) : data.next}
					>
						<ChevronRightIcon class="size-4" />
					</Button>
				{/if}
			</span>
			<span class="flex items-center gap-0.5 rounded-xl bg-muted p-[3px]">
				<a
					href="/leaderboard/{data.kind === 'month'
						? data.period
						: [`${data.period}-12`, thisMonth].sort()[0]}"
					aria-current={data.kind === 'month' ? 'page' : undefined}
					class="flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
					>Month</a
				>
				<a
					href="/leaderboard/{data.kind === 'month' ? data.year : data.period}"
					aria-current={data.kind === 'year' ? 'page' : undefined}
					class="flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
					>Year</a
				>
			</span>
		</nav>
		<AccountMenu variant="ghost" />
	{/snippet}

	<div class="mx-auto max-w-6xl space-y-10">
		{#if empty}
			<Card.Root>
				<Card.Header>
					<Card.Title>Nothing here yet</Card.Title>
					<Card.Description>
						No one has put a place up for {when}. If you have an export of your own, yours may well
						be the first.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button href="/">Read your own export</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<nav
				aria-label="Boards"
				class="grid gap-x-8 gap-y-5 md:grid-flow-col md:grid-cols-2 md:grid-rows-2"
			>
				{#each BOARD_GROUPS as group (group.label)}
					<div class="space-y-2">
						<p class="px-0.5 eyebrow">{group.label}</p>
						<div class="grid grid-cols-2 gap-2">
							{#each group.boards as id (id)}
								{@const listing = listingFor(id)}
								{@const lead = listing.entries[0]}
								<a
									href="?board={id}"
									data-sveltekit-reset="false"
									data-sveltekit-replacestate
									aria-current={focus === id ? 'true' : undefined}
									class="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:border-foreground/20 aria-[current=true]:bg-accent"
									style={focus === id ? `border-color: ${BOARD_COLOR[id]}` : ''}
								>
									<span
										class="grid size-8 shrink-0 place-items-center rounded-lg"
										style="color: {BOARD_COLOR[id]}; background: color-mix(in oklab, {BOARD_COLOR[
											id
										]} 16%, transparent)"
									>
										<BoardIcon board={id} size={16} />
									</span>
									<span class="flex min-w-0 flex-col">
										<span class="text-[13px] leading-tight font-semibold">{labelOf(id)}</span>
										<span class="truncate text-xs text-muted-foreground tabular-nums">
											{lead ? `${reading(id, lead.value)} ${unitOf(id)}` : 'Nobody yet'}
										</span>
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</nav>

			<div class="flex flex-wrap items-start gap-8">
				<section
					aria-labelledby="featured"
					class="min-w-0 flex-[999_1_560px] overflow-hidden rounded-2xl border"
					style="background: radial-gradient(90% 60% at 50% 0%, color-mix(in oklab, {BOARD_COLOR[
						focus
					]} 16%, transparent), transparent 75%), var(--card)"
				>
					<div class="flex flex-wrap items-start gap-5 p-6 sm:p-8">
						<span
							class="grid size-14 shrink-0 place-items-center rounded-2xl"
							style="color: {BOARD_COLOR[focus]}; background: color-mix(in oklab, {BOARD_COLOR[
								focus
							]} 16%, transparent)"
						>
							<BoardIcon board={focus} size={28} />
						</span>
						<div class="min-w-60 flex-1 space-y-1">
							<h2 id="featured" class="text-3xl font-bold tracking-tight">{labelOf(focus)}</h2>
							<p class="text-muted-foreground">{describe(focus)}</p>
						</div>
						<p
							class="text-sm text-muted-foreground max-sm:flex max-sm:items-baseline max-sm:gap-1.5 sm:text-right"
						>
							<span class="text-xl font-bold text-foreground tabular-nums sm:block">
								{featured.entries.length}
							</span>
							{featured.entries.length === 1 ? 'driver' : 'drivers'} listed
						</p>
					</div>

					{#if featured.entries.length === 0}
						<p class="border-t px-6 py-8 text-sm text-muted-foreground sm:px-8">
							Nobody has put a place on this board for {when} yet.
						</p>
					{:else}
						<ol
							aria-label="Top three"
							class="grid grid-cols-3 items-end gap-3 px-4 pt-10 sm:gap-4 sm:px-8"
						>
							{#each podiumOrder as entry (entry.username)}
								{@const medal = medalFor(entry.rank) ?? 'bronze'}
								{@const first = entry.rank === 1}
								<li class="flex min-w-0 flex-col items-center text-center">
									<MedalDisc
										{medal}
										board={focus}
										size={narrow ? (first ? 60 : 48) : first ? 88 : 72}
										glow
									/>
									<span class="mt-3.5 max-w-full truncate text-[15px] font-semibold">
										{entry.username}
										{#if entry.mine}<Badge variant="secondary" class="ml-1 align-middle">you</Badge
											>{/if}
									</span>
									<span class="mt-0.5 text-xs text-muted-foreground">{entry.vmodel}</span>
									<span class="mt-2.5 flex items-baseline gap-1">
										<span
											class="leading-none font-extrabold tracking-tighter tabular-nums {unitOf(
												focus
											).length > 4
												? first
													? 'text-3xl sm:text-5xl'
													: 'text-2xl sm:text-4xl'
												: first
													? 'text-4xl sm:text-6xl'
													: 'text-3xl sm:text-5xl'}"
											style="color: {BOARD_COLOR[focus]}">{reading(focus, entry.value)}</span
										>
										<span class="text-sm font-semibold whitespace-nowrap text-muted-foreground"
											>{unitOf(focus)}</span
										>
									</span>
									{#if extras(focus, entry.detail)}
										<span class="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
											{extras(focus, entry.detail)}
										</span>
									{/if}
									{#if entry.shareId}
										<a
											href="/s/{entry.shareId}"
											class="mt-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
										>
											Open it <ArrowUpRightIcon class="size-3" />
										</a>
									{/if}
									<span
										class="mt-4 flex w-full justify-center rounded-t-[14px] border border-b-0 pt-3 {first
											? 'h-28'
											: entry.rank === 2
												? 'h-[4.5rem]'
												: 'h-12'}"
										style="background: linear-gradient(180deg, color-mix(in oklab, {METALS[medal]
											.light} 22%, transparent), rgb(255 255 255 / 0.01))"
									>
										<span
											class="text-[28px] leading-none font-extrabold tabular-nums opacity-85"
											style="color: {METALS[medal].light}">{entry.rank}</span
										>
									</span>
								</li>
							{/each}
						</ol>

						{#if rest.length || unlisted}
							<ol class="border-t bg-background/40 py-2" aria-label="Further places">
								{#each rest as entry, i (entry.username)}
									{#if unlisted && unlisted.rank <= entry.rank && (i === 0 || rest[i - 1].rank < unlisted.rank)}
										{@render you(unlisted)}
									{/if}
									<li
										class="flex min-h-16 items-center gap-3 px-4 py-2 sm:gap-4 sm:px-8 {entry.mine
											? 'bg-[color-mix(in_oklab,var(--viz-1)_12%,transparent)] shadow-[inset_3px_0_0_var(--viz-1)]'
											: ''}"
									>
										<span class="w-7 font-bold text-muted-foreground tabular-nums"
											>{entry.rank}</span
										>
										<span class="flex min-w-0 flex-1 flex-col gap-0.5">
											<span class="truncate text-[15px] font-semibold">
												{entry.username}
												{#if entry.mine}<Badge variant="secondary" class="ml-1 align-middle"
														>you</Badge
													>{/if}
											</span>
											<span class="truncate text-xs text-muted-foreground">
												{entry.vmodel}{#if extras(focus, entry.detail)}{' '}
													· {extras(focus, entry.detail)}{/if}
											</span>
										</span>
										<span
											class="shrink-0 text-right text-lg font-bold whitespace-nowrap tabular-nums sm:min-w-24"
										>
											{reading(focus, entry.value)}
											<span class="text-[13px] font-medium text-muted-foreground"
												>{unitOf(focus)}</span
											>
										</span>
										<span class="hidden w-9 sm:block">
											{#if entry.shareId}
												<Button
													href="/s/{entry.shareId}"
													variant="ghost"
													size="icon"
													aria-label="Open {entry.username}'s {labelOf(focus).toLowerCase()}"
												>
													<ArrowUpRightIcon class="size-4" />
												</Button>
											{/if}
										</span>
									</li>
								{/each}
								{#if unlisted && (rest.length === 0 || rest[rest.length - 1].rank < unlisted.rank)}
									{@render you(unlisted)}
								{/if}
							</ol>
						{/if}
					{/if}
				</section>

				<aside class="flex min-w-0 flex-[1_1_320px] flex-col gap-8">
					{#if mine.length}
						<section aria-labelledby="yours" class="space-y-3">
							<div class="flex items-baseline justify-between gap-3">
								<h2 id="yours" class="text-lg font-semibold">
									{medals.length ? 'Your badges' : 'Your places'}
								</h2>
								<span class="truncate text-sm text-muted-foreground"
									>as {mine[0].entry.username}</span
								>
							</div>
							<!-- A medal gets the badge it earns; any other place is one line. -->
							{#each medals as place (place.board)}
								{@const medal = medalFor(place.entry.rank)!}
								{@const own = {
									period: data.period,
									board: place.board as BoardId,
									medal,
									rank: place.entry.rank,
									value: place.entry.value
								}}
								<figure class="space-y-2.5">
									<a
										href="?board={place.board}"
										data-sveltekit-reset="false"
										class="relative flex items-center gap-5 rounded-[20px] border border-white/10 py-5 pr-5 pl-[18px] transition-colors hover:border-white/20"
										style="background: radial-gradient(60% 120% at 14% 50%, color-mix(in oklab, {METALS[
											medal
										].light} 22%, transparent), #0e0e0d 70%)"
									>
										<MedalDisc {medal} board={place.board as BoardId} size={92} />
										<span class="flex min-w-0 flex-1 flex-col gap-1">
											<span class="truncate text-[22px] font-semibold tracking-tight text-stone-100"
												>{place.entry.username}</span
											>
											<span class="text-sm font-semibold" style="color: {METALS[medal].light}">
												{METALS[medal].name}
												<span class="font-normal text-stone-400">· {labelOf(place.board)}</span>
											</span>
											<span class="text-sm text-stone-300 tabular-nums">
												{reading(place.board, place.entry.value)}
												{unitOf(place.board)} · {heading}
											</span>
										</span>
										<span
											class="absolute top-3 right-3.5 flex items-center gap-1.5 text-[11px] font-semibold text-stone-400"
										>
											<LogoMark size={14} />
											LogbooX
										</span>
									</a>
									<figcaption class="flex flex-wrap gap-2">
										<Button
											variant="outline"
											size="sm"
											onclick={() => {
												shownBadge = own;
												badgeOpen = true;
											}}
										>
											<CodeIcon class="size-4" />
											Copy embed code
										</Button>
										<Button
											variant="outline"
											size="sm"
											href={badgePath(data.period, place.board, place.entry.username, 2)}
											download
										>
											<DownloadIcon class="size-4" />
											Download PNG
										</Button>
									</figcaption>
								</figure>
							{/each}
							{#if places.length}
								<ul class="divide-y overflow-hidden rounded-2xl border bg-card">
									{#each places as place (place.board)}
										<li>
											<a
												href="?board={place.board}"
												data-sveltekit-reset="false"
												class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
											>
												<span
													class="grid size-8 shrink-0 place-items-center rounded-lg"
													style="color: {BOARD_COLOR[
														place.board
													]}; background: color-mix(in oklab, {BOARD_COLOR[
														place.board
													]} 16%, transparent)"
												>
													<BoardIcon board={place.board} size={16} />
												</span>
												<span class="flex min-w-0 flex-1 flex-col">
													<span class="truncate text-sm font-medium">{labelOf(place.board)}</span>
													<span class="text-xs text-muted-foreground tabular-nums">
														{reading(place.board, place.entry.value)}
														{unitOf(place.board)}
													</span>
												</span>
												<span class="w-10 text-right font-bold tabular-nums"
													>#{place.entry.rank}</span
												>
											</a>
										</li>
									{/each}
								</ul>
							{/if}
							<Button href="/account#leaderboard" variant="outline" size="sm">
								Badges and places
							</Button>
						</section>
					{/if}

					{#if data.kind === 'year' && data.summary.podiums.length > 0}
						<section aria-labelledby="podiums" class="overflow-hidden rounded-2xl border bg-card">
							<div class="px-6 pt-5 pb-3">
								<h2 id="podiums" class="text-lg font-semibold">Most podium places</h2>
								<p class="text-sm text-muted-foreground">Across every board in {data.period}</p>
							</div>
							<div class="flex items-center gap-3 border-t px-6 py-2 text-xs text-muted-foreground">
								<span class="flex-1">Driver</span>
								<span class="w-12 text-right" title="Wins">
									<span
										class="inline-block size-3 rounded-full"
										style="background: {METALS.gold.light}"
									></span>
								</span>
								<span class="w-16 text-right">Top three</span>
							</div>
							<ol>
								{#each data.summary.podiums as row, i (row.username)}
									<li class="flex items-center gap-3 border-t px-6 py-3 text-sm">
										<span class="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
										<span class="min-w-0 flex-1 truncate font-medium">{row.username}</span>
										<span class="w-12 text-right font-semibold tabular-nums">{row.wins}</span>
										<span class="w-16 text-right font-semibold tabular-nums">{row.podiums}</span>
									</li>
								{/each}
							</ol>
						</section>
					{/if}

					<section aria-labelledby="how" class="space-y-3">
						<h2 id="how" class="text-base font-semibold">How a place gets here</h2>
						<p class="text-sm leading-relaxed text-muted-foreground">
							Every figure came out of one driver's own export, worked out in their browser, and
							appears because they chose to put their name to it. Sign in, keep an export in your
							account, and LogbooX will tell you when something of yours would rank. Nothing is
							published until you say so, and you can take it back down at any time.
						</p>
						<div class="flex flex-wrap gap-2">
							<Button href="/" size="sm">Read your own export</Button>
							{#if account.signedIn && !mine.length}
								<Button href="/account#leaderboard" variant="outline" size="sm">Your places</Button>
							{/if}
						</div>
					</section>
				</aside>
			</div>
		{/if}

		<BadgeDialog
			bind:open={badgeOpen}
			badge={shownBadge}
			username={mine[0]?.entry.username ?? ''}
		/>
	</div>
</AppShell>
