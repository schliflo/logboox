<!--
  "This one would rank."

  Shown against the trip or the charge it is actually about, because that is
  where somebody can tell whether it was a real drive or the afternoon the car
  went on a transporter. Nothing here is published; the claim is a decision
  made on this screen and nowhere else.
-->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { account } from '$lib/state/account.svelte';
	import { data } from '$lib/state/dataset.svelte';
	import { boardById, formatValue } from '$lib/leaderboard/boards';
	import { monthLabel } from '$lib/leaderboard/periods';
	import { dateOnly } from '$lib/utils/format';
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
		candidate && board ? `${formatValue(board, candidate.value)} ${board.unit}` : ''
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
			toast(`You are #${rank} for ${board?.label ?? 'that board'}`, {
				description: 'Take it down again whenever you like, from your account.'
			});
		} catch (error) {
			toast('That place could not be taken', {
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
			nameError = error instanceof Error ? error.message : 'That name could not be saved.';
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
			On the board: <strong>#{held.rank}</strong> for
			{boardById(held.board)?.label ?? held.board} in {monthLabel(held.month)}
		</span>
		<a
			href="/leaderboard/{held.month}"
			class="ml-auto text-xs underline underline-offset-4 hover:text-foreground"
		>
			See it
		</a>
	</div>
{:else if candidate && board}
	<div class="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
		<div class="flex flex-wrap items-center gap-2">
			<TrophyIcon class="size-5 shrink-0 text-primary" />
			<p class="text-sm">
				This would be <strong>#{candidate.rank}</strong> for
				<strong>{board.label}</strong> in {monthLabel(candidate.month)}
			</p>
			<Badge variant="secondary" class="tabular-nums">{reading}</Badge>
		</div>

		{#if naming}
			<div class="space-y-2">
				<p class="text-xs text-muted-foreground">
					Boards show a name rather than your e-mail. Choose one and this place is yours.
				</p>
				<div class="flex flex-wrap gap-2">
					<Input
						bind:value={username}
						placeholder="Pick a name"
						maxlength={24}
						class="max-w-48"
						autocomplete="off"
					/>
					<Button size="sm" disabled={busy} onclick={chooseName}>Claim it</Button>
					<Button size="sm" variant="ghost" disabled={busy} onclick={() => (naming = false)}>
						Cancel
					</Button>
				</div>
				{#if nameError}
					<p class="text-xs text-destructive">{nameError}</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" disabled={busy} onclick={take}>Claim it</Button>
				<Button size="sm" variant="ghost" disabled={busy} onclick={decline}>Not this one</Button>
				<span class="text-xs text-muted-foreground">
					Nothing is published until you say so · open until {dateOnly(candidate.locksAt)}
				</span>
			</div>
		{/if}
	</div>
{/if}
