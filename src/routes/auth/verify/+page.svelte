<!--
  The end of a sign-in link.

  The link does not sign anyone in by being opened: this page reads the token
  out of the URL and waits for a deliberate click. Mail clients and security
  scanners fetch every link they are sent, and a link that spent itself on
  sight would be used up before the reader ever saw it.

  The page itself is static — it holds no secret and does no server work, so it
  is prerendered like the rest of the app and the token never leaves the
  browser except in the request that spends it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Seo from '$lib/components/app/Seo.svelte';
	import { account } from '$lib/state/account.svelte';
	import { ACCOUNTS_ENABLED } from '$lib/features';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertIcon from '@lucide/svelte/icons/triangle-alert';

	let token = $state<string | null>(null);
	let busy = $state(false);
	let failure = $state<{ message: string; hint?: string } | null>(null);

	onMount(() => {
		token = page.url.searchParams.get('token');
	});

	async function confirm() {
		if (!token) return;
		busy = true;
		failure = null;
		try {
			const result = await account.verify(token);
			// The address is now in the URL bar and in history; replacing it
			// keeps a spent token out of both.
			await goto('/account', { replaceState: true });
			toast(result.created ? 'Welcome to LogbooX' : 'Signed in', {
				description: result.created
					? 'Your account is ready. Nothing has been uploaded to it yet.'
					: 'Everything you kept in this browser is still here.'
			});
		} catch (error) {
			failure = {
				message: error instanceof Error ? error.message : 'That link could not be used.',
				hint: error instanceof Error && 'hint' in error ? (error.hint as string) : undefined
			};
		} finally {
			busy = false;
		}
	}
</script>

<Seo title="Sign in" path="/auth/verify" noindex />

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title>Sign in to LogbooX</Card.Title>
			<Card.Description>
				{#if !ACCOUNTS_ENABLED}
					This address does not host accounts.
				{:else if token}
					One click to finish. The link works once.
				{:else}
					This link is missing its token.
				{/if}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			{#if !ACCOUNTS_ENABLED}
				<p class="text-sm text-muted-foreground">
					Sign in at <a class="text-primary underline underline-offset-4" href="https://logboox.app"
						>logboox.app</a
					> instead.
				</p>
			{:else if failure}
				<div class="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
					<AlertIcon class="mt-0.5 size-5 shrink-0 text-destructive" />
					<div class="space-y-1 text-sm">
						<p class="font-medium">{failure.message}</p>
						{#if failure.hint}
							<p class="text-muted-foreground">{failure.hint}</p>
						{/if}
					</div>
				</div>
				<Button variant="outline" class="w-full" onclick={() => goto('/')}>
					Back to the start
				</Button>
			{:else if token}
				<Button class="w-full" onclick={confirm} disabled={busy}>
					<CheckIcon class="size-4" />
					{busy ? 'Signing in…' : 'Sign in'}
				</Button>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Nothing happens until you press that. Links in e-mail are often opened by software before
					a person sees them, which is why this one waits.
				</p>
			{:else}
				<Button variant="outline" class="w-full" onclick={() => goto('/')}>
					Back to the start
				</Button>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
