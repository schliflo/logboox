<!--
  "This one would rank."

  Shown against the trip or the charge it is actually about, because that is
  where somebody can tell whether it was a real drive or the afternoon the car
  went on a transporter. Nothing here is published; the claim is a decision
  made on this screen and nowhere else.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { account } from '#lib/state/account.svelte.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { boardById } from '#lib/leaderboard/boards.js';
	import { monthLabel } from '#lib/i18n/dates.js';
	import { boardText, boardValue } from '#lib/i18n/boards.js';
	import { dateOnly } from '#lib/utils/format.js';
	import TrophyIcon from '@lucide/svelte/icons/trophy';

	interface Props {
		/** The start of the trip or session on screen, in epoch seconds. */
		startTime: number;
	}

	let { startTime }: Props = $props();

	let busy = $state(false);
	let naming = $state(false);
	let username = $state('');
	let nameError = $state<string | null>(null);

	const vin = $derived(data.dataset?.vin ?? '');
	const candidate = $derived(account.signedIn ? account.candidateFor(vin, startTime) : null);
	const held = $derived(account.signedIn ? account.entryFor(vin, startTime) : null);
	const board = $derived(candidate ? boardById(candidate.board) : null);

	const reading = $derived(
		candidate && board ? `${boardValue(board, candidate.value)} ${board.unit}` : ''
	);

	async function take() {
		if (!candidate) return;
		if (!account.user?.username) {
			naming = true;
			return;
		}
		busy = true;
		try {
			const { rank } = await account.claim(candidate.id);
			toast(m.claims.youAre(rank, board ? boardText(board.id).label : m.claims.thatBoard), {
				description: m.claims.takeDownLater
			});
		} catch (error) {
			toast(m.claims.claimFailed, {
				description: error instanceof Error ? error.message : undefined,
				closeButton: true
			});
		} finally {
			busy = false;
		}
	}

	async function chooseName() {
		busy = true;
		nameError = null;
		try {
			await account.setUsername(username);
			naming = false;
			await take();
		} catch (error) {
			nameError = error instanceof Error ? error.message : m.claims.nameFailed;
		} finally {
			busy = false;
		}
	}

	async function decline() {
		if (!candidate) return;
		busy = true;
		try {
			await account.dismiss(candidate.id);
		} finally {
			busy = false;
		}
	}
</script>

{#if held}
	<div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card/50 p-3 text-sm">
		<TrophyIcon class="size-4 shrink-0 text-primary" />
		<span>
			{m.claims.onTheBoard} <strong>#{held.rank}</strong>
			{m.claims.forIn(
				boardById(held.board) ? boardText(boardById(held.board)!.id).label : held.board,
				monthLabel(held.month)
			)}
		</span>
		<a
			href="/leaderboard/{held.month}"
			class="ml-auto text-xs underline underline-offset-4 hover:text-foreground"
		>
			{m.claims.seeIt}
		</a>
	</div>
{:else if candidate && board}
	<div class="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
		<div class="flex flex-wrap items-center gap-2">
			<TrophyIcon class="size-5 shrink-0 text-primary" />
			<p class="text-sm">
				{m.claims.wouldBe} <strong>#{candidate.rank}</strong>
				{m.claims.forBoard}
				<strong>{boardText(board.id).label}</strong>
				{m.claims.inMonth(monthLabel(candidate.month))}
			</p>
			<Badge variant="secondary" class="tabular-nums">{reading}</Badge>
		</div>

		{#if naming}
			<div class="space-y-2">
				<p class="text-xs text-muted-foreground">
					{m.claims.nameHint}
				</p>
				<div class="flex flex-wrap gap-2">
					<Input
						bind:value={username}
						placeholder={m.claims.pickName}
						maxlength={24}
						class="max-w-48"
						autocomplete="off"
					/>
					<Button size="sm" disabled={busy} onclick={chooseName}>{m.claims.claim}</Button>
					<Button size="sm" variant="ghost" disabled={busy} onclick={() => (naming = false)}>
						{m.common.cancel}
					</Button>
				</div>
				{#if nameError}
					<p class="text-xs text-destructive">{nameError}</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" disabled={busy} onclick={take}>{m.claims.claim}</Button>
				<Button size="sm" variant="ghost" disabled={busy} onclick={decline}
					>{m.claims.noThanks}</Button
				>
				<span class="text-xs text-muted-foreground">
					{m.claims.notPublished(dateOnly(candidate.locksAt))}
				</span>
			</div>
		{/if}
	</div>
{/if}
