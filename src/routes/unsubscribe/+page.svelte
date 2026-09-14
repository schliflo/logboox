<!--
  Stopping one kind of message.

  A button rather than an automatic switch, for the same reason the sign-in
  link has one: mail clients follow links before anyone reads them, and a
  preference silently changed by a scanner is a preference nobody chose.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Seo from '$lib/components/app/Seo.svelte';
	import { api } from '$lib/api/client';

	let token = $state<string | null>(null);
	/** Which mail this link came from; each kind has its own switch and token. */
	let kind = $state<'reminders' | 'leaderboard'>('reminders');
	let busy = $state(false);
	let done = $state<string | null>(null);
	let failure = $state<{ message: string; hint?: string } | null>(null);

	onMount(() => {
		token = page.url.searchParams.get('token');
		if (page.url.searchParams.get('kind') === 'leaderboard') kind = 'leaderboard';
	});

	async function confirm() {
		if (!token) return;
		busy = true;
		failure = null;
		try {
			const result = await api<{ email: string }>('/api/v1/unsubscribe', {
				method: 'POST',
				body: { token, kind }
			});
			done = result.email;
		} catch (error) {
			failure = {
				message: error instanceof Error ? error.message : 'That did not work.',
				hint: error instanceof Error && 'hint' in error ? (error.hint as string) : undefined
			};
		} finally {
			busy = false;
		}
	}
</script>

<Seo title="E-mail" path="/unsubscribe" noindex />

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title>
				{#if done}
					{kind === 'leaderboard' ? 'Leaderboard messages are off' : 'Reminders are off'}
				{:else if kind === 'leaderboard'}
					Stop messages about places on a board?
				{:else}
					Stop reminders about new exports?
				{/if}
			</Card.Title>
			<Card.Description>
				{#if done}
					{done} will not be e-mailed again unless you turn them back on.
				{:else if kind === 'leaderboard'}
					Your places stay exactly as they are. This only stops the messages telling you when one of
					your trips would rank.
				{:else}
					You will still be able to import exports whenever you like. This only stops the messages.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if done}
				<p class="text-sm text-muted-foreground">
					XPeng only keeps a rolling thirty days, so without a reminder it is worth putting a note
					in your own calendar.
				</p>
				<Button variant="outline" class="w-full" onclick={() => goto('/account')}>
					Back to your account
				</Button>
			{:else if failure}
				<p class="text-sm font-medium text-destructive">{failure.message}</p>
				{#if failure.hint}
					<p class="text-sm text-muted-foreground">{failure.hint}</p>
				{/if}
				<Button variant="outline" class="w-full" onclick={() => goto('/account')}>
					Open your account
				</Button>
			{:else if token}
				<Button class="w-full" onclick={confirm} disabled={busy}>
					{busy ? 'Turning them off…' : 'Stop the reminders'}
				</Button>
			{:else}
				<p class="text-sm text-muted-foreground">This link is missing its token.</p>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
