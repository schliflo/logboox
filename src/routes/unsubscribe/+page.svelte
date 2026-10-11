<!--
  Stopping one kind of message.

  A button rather than an automatic switch, for the same reason the sign-in
  link has one: mail clients follow links before anyone reads them, and a
  preference silently changed by a scanner is a preference nobody chose.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import { api } from '#lib/api/client.js';

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
				message: error instanceof Error ? error.message : m.unsubscribe.failed,
				hint: error instanceof Error && 'hint' in error ? (error.hint as string) : undefined
			};
		} finally {
			busy = false;
		}
	}
</script>

<Seo title={m.unsubscribe.title} path="/unsubscribe" noindex />

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title>
				{#if done}
					{kind === 'leaderboard' ? m.unsubscribe.boardOff : m.unsubscribe.remindersOff}
				{:else if kind === 'leaderboard'}
					{m.unsubscribe.stopBoard}
				{:else}
					{m.unsubscribe.stopReminders}
				{/if}
			</Card.Title>
			<Card.Description>
				{#if done}
					{#if kind === 'leaderboard'}
						{m.unsubscribe.boardDone(done)}
					{:else}
						{m.unsubscribe.remindersDone(done)}
					{/if}
				{:else if kind === 'leaderboard'}
					{m.unsubscribe.boardExplain}
				{:else}
					{m.unsubscribe.remindersExplain}
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if done}
				{#if kind === 'reminders'}
					<p class="text-sm text-muted-foreground">
						{m.unsubscribe.calendar}
					</p>
				{/if}
				<Button variant="outline" class="w-full" onclick={() => goto('/account')}>
					{m.unsubscribe.backToAccount}
				</Button>
			{:else if failure}
				<p class="text-sm font-medium text-destructive">{failure.message}</p>
				{#if failure.hint}
					<p class="text-sm text-muted-foreground">{failure.hint}</p>
				{/if}
				<Button variant="outline" class="w-full" onclick={() => goto('/account')}>
					{m.unsubscribe.openAccount}
				</Button>
			{:else if token}
				<Button class="w-full" onclick={confirm} disabled={busy}>
					{#if busy}
						{m.unsubscribe.turningOff}
					{:else if kind === 'leaderboard'}
						{m.unsubscribe.stopThese}
					{:else}
						{m.unsubscribe.stopTheReminders}
					{/if}
				</Button>
			{:else}
				<p class="text-sm text-muted-foreground">{m.unsubscribe.noToken}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
