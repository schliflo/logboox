<!--
  Places waiting on an answer, and places already taken.

  The one screen where this feature actually happens. Everything the app has
  noticed is here and none of it is public yet; each row is an offer with two
  answers, and the second one — no — is as easy as the first.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { account, type BoardCandidate, type BoardEntry } from '#lib/state/account.svelte.js';
	import { boardById, type BoardId } from '#lib/leaderboard/boards.js';
	import { monthLabel, periodLabel } from '#lib/i18n/dates.js';
	import { boardText, boardValue, medalName } from '#lib/i18n/boards.js';
	import type { Medal, OwnBadge } from '#lib/leaderboard/medals.js';
	import BadgeDialog from '#lib/components/app/BadgeDialog.svelte';
	import { dateOnly } from '#lib/utils/format.js';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import ExternalIcon from '@lucide/svelte/icons/external-link';
	import MedalIcon from '@lucide/svelte/icons/medal';

	let username = $state('');
	let savingName = $state(false);
	let nameError = $state<string | null>(null);
	let working = $state<string | null>(null);

	const pending = $derived(account.leaderboard.pending);
	const entries = $derived(account.leaderboard.entries);
	const badges = $derived(account.leaderboard.badges ?? []);

	const MEDAL_COLORS: Record<Medal, string> = {
		gold: '#d4a017',
		silver: '#9aa0a6',
		bronze: '#b0703a'
	};

	let badgeOpen = $state(false);
	let badgeShown = $state<OwnBadge | null>(null);

	function showBadge(badge: OwnBadge) {
		badgeShown = badge;
		badgeOpen = true;
	}

	/** A year reads as such; a month by its name. */
	function whenOf(period: string): string {
		return /^\d{4}$/.test(period) ? m.claims.yearSuffix(period) : periodLabel(period);
	}

	onMount(() => {
		username = account.user?.username ?? '';
		// Seeing them here is the whole reason a nudge would be sent later.
		account.markSeen();
	});

	function label(id: string): string {
		return boardById(id) ? boardText(id as BoardId).label : id;
	}

	function reading(id: string, value: number): string {
		const board = boardById(id);
		return board ? `${boardValue(board, value)} ${board.unit}` : String(value);
	}

	async function saveName() {
		savingName = true;
		nameError = null;
		try {
			await account.setUsername(username);
			toast(m.claims.nameSaved);
		} catch (error) {
			nameError = error instanceof Error ? error.message : m.claims.nameFailed;
		} finally {
			savingName = false;
		}
	}

	async function take(candidate: BoardCandidate) {
		working = candidate.id;
		try {
			const { rank } = await account.claim(candidate.id);
			toast(m.claims.youAre(rank, label(candidate.board)), {
				description: m.claims.takeDownLaterMonth(monthLabel(candidate.month))
			});
		} catch (error) {
			toast(m.claims.claimFailed, {
				description: error instanceof Error ? error.message : undefined,
				closeButton: true
			});
		} finally {
			working = null;
		}
	}

	async function decline(candidate: BoardCandidate) {
		working = candidate.id;
		try {
			await account.dismiss(candidate.id);
		} finally {
			working = null;
		}
	}

	async function withdraw(entry: BoardEntry) {
		working = entry.id;
		try {
			await account.removeEntry(entry.id);
			toast(m.claims.takenDown, {
				description: m.claims.takenDownDetail
			});
		} finally {
			working = null;
		}
	}

	async function setNotify(value: boolean) {
		try {
			await account.updateSettings({ boardNotify: value });
		} catch {
			toast(m.claims.saveFailed, { description: account.error ?? undefined });
		}
	}
</script>

<Card.Root id="leaderboard">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<TrophyIcon class="size-5 text-primary" />
			{m.claims.title}
		</Card.Title>
		<Card.Description>
			{m.claims.description}
		</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-6">
		<div class="space-y-2">
			<Label for="username">{m.claims.nameLabel}</Label>
			<div class="flex flex-wrap gap-2">
				<Input
					id="username"
					bind:value={username}
					placeholder={m.claims.pickName}
					maxlength={24}
					class="max-w-56"
					autocomplete="off"
				/>
				<Button
					variant="outline"
					disabled={savingName || username.trim() === (account.user?.username ?? '')}
					onclick={saveName}
				>
					{account.user?.username ? m.claims.change : m.claims.choose}
				</Button>
			</div>
			{#if nameError}
				<p class="text-xs text-destructive">{nameError}</p>
			{:else}
				<p class="text-xs text-muted-foreground">
					{m.claims.nameRules}
				</p>
			{/if}
		</div>

		<Separator />

		<div class="flex items-center justify-between gap-4">
			<div class="space-y-1">
				<Label for="board-notify" class="font-normal">{m.claims.notify}</Label>
				<p class="text-xs text-muted-foreground">
					{m.claims.notifyHint}
				</p>
			</div>
			<Switch
				id="board-notify"
				checked={account.user?.boardNotify ?? true}
				onCheckedChange={setNotify}
			/>
		</div>

		{#if pending.length > 0}
			<Separator />
			<div class="space-y-3">
				<h3 class="text-sm font-medium">{m.claims.waiting}</h3>
				<ul class="divide-y rounded-lg border">
					{#each pending as candidate (candidate.id)}
						<li class="flex flex-wrap items-center gap-3 p-3">
							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">
									{label(candidate.board)}
									<span class="text-muted-foreground">— #{candidate.rank}</span>
								</p>
								<p class="text-xs text-muted-foreground">
									{reading(candidate.board, candidate.value)} · {monthLabel(candidate.month)} ·
									{m.claims.openUntil(dateOnly(candidate.locksAt))}
								</p>
							</div>
							<div class="flex gap-2">
								<Button
									size="sm"
									disabled={working === candidate.id}
									onclick={() => take(candidate)}
								>
									{m.claims.claim}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={working === candidate.id}
									onclick={() => decline(candidate)}
								>
									{m.claims.noThanks}
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if entries.length > 0}
			<Separator />
			<div class="space-y-3">
				<h3 class="text-sm font-medium">{m.claims.onBoards}</h3>
				<ul class="divide-y rounded-lg border">
					{#each entries as entry (entry.id)}
						<li class="flex flex-wrap items-center gap-3 p-3">
							<Badge variant="secondary" class="tabular-nums">#{entry.rank}</Badge>
							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">{label(entry.board)}</p>
								<p class="text-xs text-muted-foreground">
									{reading(entry.board, entry.value)} · {monthLabel(entry.month)}
									{#if entry.locked}· {m.claims.closed}{/if}
								</p>
							</div>
							<a
								href="/leaderboard/{entry.month}"
								class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							>
								{m.claims.seeBoard}
							</a>
							<Button
								size="sm"
								variant="ghost"
								disabled={working === entry.id}
								onclick={() => withdraw(entry)}
							>
								{m.claims.takeDown}
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if badges.length > 0}
			<Separator />
			<div class="space-y-3">
				<h3 class="text-sm font-medium">{m.claims.badges}</h3>
				<ul class="divide-y rounded-lg border">
					{#each badges as badge (`${badge.period}/${badge.board}`)}
						<li class="flex flex-wrap items-center gap-3 p-3">
							<MedalIcon
								class="size-5 shrink-0"
								style="color: {MEDAL_COLORS[badge.medal]}"
								aria-label={m.claims.medal(medalName(badge.medal))}
							/>
							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">{label(badge.board)}</p>
								<p class="text-xs text-muted-foreground">
									{reading(badge.board, badge.value)} · {whenOf(badge.period)}
								</p>
							</div>
							<Button size="sm" variant="outline" onclick={() => showBadge(badge)}
								>{m.claims.getBadge}</Button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if pending.length === 0 && entries.length === 0}
			<p class="text-sm text-muted-foreground">
				{m.claims.nothingYet}
			</p>
		{/if}
	</Card.Content>

	<Card.Footer>
		<Button href="/leaderboard" variant="outline" size="sm">
			{m.claims.seeMonth}
			<ExternalIcon class="size-4" />
		</Button>
	</Card.Footer>
</Card.Root>

<BadgeDialog bind:open={badgeOpen} badge={badgeShown} username={account.user?.username ?? ''} />
