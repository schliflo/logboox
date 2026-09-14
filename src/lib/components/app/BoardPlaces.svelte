<!--
  Places waiting on an answer, and places already taken.

  The one screen where this feature actually happens. Everything the app has
  noticed is here and none of it is public yet; each row is an offer with two
  answers, and the second one — no — is as easy as the first.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import { account, type BoardCandidate, type BoardEntry } from '$lib/state/account.svelte';
	import { boardById, formatValue } from '$lib/leaderboard/boards';
	import { monthLabel } from '$lib/leaderboard/periods';
	import { dateOnly } from '$lib/utils/format';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import ExternalIcon from '@lucide/svelte/icons/external-link';

	let username = $state('');
	let savingName = $state(false);
	let nameError = $state<string | null>(null);
	let working = $state<string | null>(null);

	const pending = $derived(account.leaderboard.pending);
	const entries = $derived(account.leaderboard.entries);

	onMount(() => {
		username = account.user?.username ?? '';
		// Seeing them here is the whole reason a nudge would be sent later.
		account.markSeen();
	});

	function label(id: string): string {
		return boardById(id)?.label ?? id;
	}

	function reading(id: string, value: number): string {
		const board = boardById(id);
		return board ? `${formatValue(board, value)} ${board.unit}` : String(value);
	}

	async function saveName() {
		savingName = true;
		nameError = null;
		try {
			await account.setUsername(username);
			toast('That is the name your places will show');
		} catch (error) {
			nameError = error instanceof Error ? error.message : 'That name could not be saved.';
		} finally {
			savingName = false;
		}
	}

	async function take(candidate: BoardCandidate) {
		working = candidate.id;
		try {
			const { rank } = await account.claim(candidate.id);
			toast(`You are #${rank} for ${label(candidate.board)}`, {
				description: `${monthLabel(candidate.month)}. You can take it down again whenever you like.`
			});
		} catch (error) {
			toast('That place could not be taken', {
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
			toast('Taken down', { description: 'It is gone from the board for everyone.' });
		} finally {
			working = null;
		}
	}

	async function setNotify(value: boolean) {
		try {
			await account.updateSettings({ boardNotify: value });
		} catch {
			toast('That could not be saved', { description: account.error ?? undefined });
		}
	}
</script>

<Card.Root id="leaderboard">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<TrophyIcon class="size-5 text-primary" />
			Leaderboard
		</Card.Title>
		<Card.Description>
			Nothing of yours appears on a board unless you put it there. When one of your trips would
			rank, it is listed here first.
		</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-6">
		<div class="space-y-2">
			<Label for="username">The name your places appear under</Label>
			<div class="flex flex-wrap gap-2">
				<Input
					id="username"
					bind:value={username}
					placeholder="Pick a name"
					maxlength={24}
					class="max-w-56"
					autocomplete="off"
				/>
				<Button
					variant="outline"
					disabled={savingName || username.trim() === (account.user?.username ?? '')}
					onclick={saveName}
				>
					{account.user?.username ? 'Change' : 'Choose'}
				</Button>
			</div>
			{#if nameError}
				<p class="text-xs text-destructive">{nameError}</p>
			{:else}
				<p class="text-xs text-muted-foreground">
					Letters, digits, hyphens and underscores. It is the only thing about you a board shows —
					not your e-mail, not your car.
				</p>
			{/if}
		</div>

		<Separator />

		<div class="flex items-center justify-between gap-4">
			<div class="space-y-1">
				<Label for="board-notify" class="font-normal">Tell me when a trip would rank</Label>
				<p class="text-xs text-muted-foreground">
					In the app, and by e-mail if you have not been back in a couple of days.
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
				<h3 class="text-sm font-medium">Waiting on you</h3>
				<ul class="divide-y rounded-lg border">
					{#each pending as candidate (candidate.id)}
						<li class="flex flex-wrap items-center gap-3 p-3">
							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">
									{label(candidate.board)}
									<span class="text-muted-foreground">— #{candidate.rank}</span>
								</p>
								<p class="text-xs text-muted-foreground">
									{reading(candidate.board, candidate.value)} · {monthLabel(candidate.month)} · open until
									{dateOnly(candidate.locksAt)}
								</p>
							</div>
							<div class="flex gap-2">
								<Button
									size="sm"
									disabled={working === candidate.id}
									onclick={() => take(candidate)}
								>
									Claim it
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={working === candidate.id}
									onclick={() => decline(candidate)}
								>
									No thanks
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
				<h3 class="text-sm font-medium">On the boards</h3>
				<ul class="divide-y rounded-lg border">
					{#each entries as entry (entry.id)}
						<li class="flex flex-wrap items-center gap-3 p-3">
							<Badge variant="secondary" class="tabular-nums">#{entry.rank}</Badge>
							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">{label(entry.board)}</p>
								<p class="text-xs text-muted-foreground">
									{reading(entry.board, entry.value)} · {monthLabel(entry.month)}
									{#if entry.locked}· closed{/if}
								</p>
							</div>
							<a
								href="/leaderboard/{entry.month}"
								class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							>
								See the board
							</a>
							<Button
								size="sm"
								variant="ghost"
								disabled={working === entry.id}
								onclick={() => withdraw(entry)}
							>
								Take down
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if pending.length === 0 && entries.length === 0}
			<p class="text-sm text-muted-foreground">
				Nothing yet. Keep an export in your account and anything of yours worth a place will turn up
				here.
			</p>
		{/if}
	</Card.Content>

	<Card.Footer>
		<Button href="/leaderboard" variant="outline" size="sm">
			See this month's boards
			<ExternalIcon class="size-4" />
		</Button>
	</Card.Footer>
</Card.Root>
