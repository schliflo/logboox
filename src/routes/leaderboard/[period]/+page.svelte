<!--
  The boards, as anyone may read them.

  Every number here was worked out in the browser of the person it belongs to,
  out of a file XPeng gave them, and published because they said so. That is
  worth saying on the page rather than assuming, because a scoreboard invites
  exactly the question of where its numbers came from.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Seo from '$lib/components/app/Seo.svelte';
	import MadeBy from '$lib/components/app/MadeBy.svelte';
	import AccountMenu from '$lib/components/app/AccountMenu.svelte';
	import { boardById, formatValue } from '$lib/leaderboard/boards';
	import { monthLabel } from '$lib/leaderboard/periods';
	import { dateOnly, num } from '$lib/utils/format';
	import { account } from '$lib/state/account.svelte';
	import { absolute } from '$lib/seo';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const heading = $derived(
		data.kind === 'month' ? monthLabel(data.period) : `The year ${data.period}`
	);

	const listings = $derived(
		data.kind === 'month'
			? data.listings
			: data.summary.boards.map((board) => ({ board: board.board, entries: board.entries }))
	);

	const empty = $derived(listings.every((listing) => listing.entries.length === 0));

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
	title="Leaderboards · {heading}"
	description="What XPeng drivers have put their name to this month: the fastest charge, the longest drive, the most efficient run."
	path="/leaderboard/{data.period}"
	image={absolute(`/leaderboard/${data.period}/og.png`) ?? undefined}
	imageAlt="The names and figures leading the LogbooX boards for {heading}."
/>

<main class="mx-auto min-h-svh max-w-4xl space-y-6 px-6 py-12">
	<header class="space-y-4">
		<div class="flex flex-wrap items-center gap-2">
			<a href="/" class="flex items-center gap-2 text-sm font-medium hover:opacity-80">
				<img src="/favicon.svg" alt="" width="24" height="24" class="size-6" />
				LogbooX
			</a>
			<div class="ml-auto">
				<AccountMenu variant="outline" />
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<h1 class="flex items-center gap-2 text-3xl font-semibold tracking-tight">
				<TrophyIcon class="size-7 text-primary" />
				{heading}
			</h1>
			{#if data.open}
				<Badge variant="secondary">Open until {dateOnly(data.locksAt)}</Badge>
			{:else}
				<Badge variant="outline">Final</Badge>
			{/if}
		</div>

		<p class="max-w-2xl text-sm text-pretty text-muted-foreground">
			Every figure here came out of one driver's own vehicle export, worked out in their browser,
			and appears because they chose to put their name to it. Nothing is entered automatically.
		</p>

		<nav class="flex flex-wrap items-center gap-2">
			<Button href="/leaderboard/{data.previous}" variant="ghost" size="sm">
				<ArrowLeftIcon class="size-4" />
				{data.kind === 'month' ? monthLabel(data.previous) : data.previous}
			</Button>
			<Button href="/leaderboard/{data.next}" variant="ghost" size="sm">
				{data.kind === 'month' ? monthLabel(data.next) : data.next}
				<ArrowRightIcon class="size-4" />
			</Button>
			{#if data.kind === 'month'}
				<Button href="/leaderboard/{data.year}" variant="outline" size="sm">
					The whole of {data.year}
				</Button>
			{/if}
		</nav>
	</header>

	{#if empty}
		<Card.Root>
			<Card.Header>
				<Card.Title>Nothing here yet</Card.Title>
				<Card.Description>
					No one has put a place up for {heading}. If you have an export of your own, yours may well
					be the first.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/">Read your own export</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each listings as listing (listing.board)}
				{#if listing.entries.length > 0}
					<Card.Root>
						<Card.Header>
							<Card.Title class="text-base">{labelOf(listing.board)}</Card.Title>
							<Card.Description>{describe(listing.board)}</Card.Description>
						</Card.Header>
						<Card.Content>
							<ol class="divide-y">
								{#each listing.entries as entry (entry.rank + entry.username)}
									<li
										class="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 {entry.mine
											? 'font-medium'
											: ''}"
									>
										<span class="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
											{entry.rank}
										</span>
										<span class="min-w-24 flex-1 truncate text-sm">
											{entry.username}
											{#if entry.mine}
												<Badge variant="secondary" class="ml-1 align-middle">you</Badge>
											{/if}
										</span>
										<span class="text-sm tabular-nums">
											{reading(listing.board, entry.value)}
											<span class="text-xs text-muted-foreground">{unitOf(listing.board)}</span>
										</span>
									</li>
									<li
										class="flex flex-wrap items-center gap-2 pb-2 pl-9 text-xs text-muted-foreground"
									>
										<span>{entry.vmodel}</span>
										{#if extras(listing.board, entry.detail)}
											<span>· {extras(listing.board, entry.detail)}</span>
										{/if}
										{#if entry.shareId}
											<a
												href="/s/{entry.shareId}"
												class="underline underline-offset-4 hover:text-foreground"
											>
												see it
											</a>
										{/if}
									</li>
								{/each}
							</ol>
						</Card.Content>
					</Card.Root>
				{/if}
			{/each}
		</div>
	{/if}

	{#if data.kind === 'year' && data.summary.podiums.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Most places in the top three</Card.Title>
				<Card.Description>Across every board, month by month.</Card.Description>
			</Card.Header>
			<Card.Content>
				<ol class="divide-y">
					{#each data.summary.podiums as row (row.username)}
						<li class="flex items-baseline gap-3 py-2 text-sm">
							<span class="min-w-24 flex-1 truncate">{row.username}</span>
							<span class="tabular-nums">{row.podiums}</span>
							<span class="text-xs text-muted-foreground">
								{row.wins}
								{row.wins === 1 ? 'win' : 'wins'}
							</span>
						</li>
					{/each}
				</ol>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root class="border-primary/30">
		<Card.Header>
			<Card.Title>How a place gets here</Card.Title>
			<Card.Description>
				Sign in, keep an export in your account, and LogbooX will tell you when one of your own
				trips or charges would rank. Nothing is published until you say so, and you can take it back
				down at any time — including after a month has closed.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-wrap gap-3">
			<Button href="/">Read your own export</Button>
			{#if account.signedIn}
				<Button href="/account#leaderboard" variant="outline">Your places</Button>
			{/if}
		</Card.Content>
	</Card.Root>

	<footer class="flex justify-center pt-4">
		<MadeBy />
	</footer>
</main>
