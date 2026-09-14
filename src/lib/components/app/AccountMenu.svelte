<!--
  Signing in, where it is offered at all.

  Optional by design: the app has always worked without an account and still
  does, so this is a quiet control rather than a wall. What an account adds is
  named in the dialog, because "sign in" on a page that promises nothing is
  uploaded deserves an explanation before an address is typed into it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { account } from '$lib/state/account.svelte';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import MailIcon from '@lucide/svelte/icons/mail';
	import UserIcon from '@lucide/svelte/icons/circle-user';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TrophyIcon from '@lucide/svelte/icons/trophy';

	interface Props {
		/** Ghost suits a dashboard header; outline suits the landing page. */
		variant?: 'ghost' | 'outline';
	}

	let { variant = 'outline' }: Props = $props();

	let open = $state(false);
	let email = $state('');

	const benefits = [
		'Keep your exports for good, not just until this browser forgets them',
		'A reminder when the next export is due, before the window rolls past',
		'Read your own data over an API, for Home Assistant and anything else',
		'Share a single trip or charging session with a link'
	];

	onMount(() => {
		account.refresh();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		try {
			await account.requestLink(email);
		} catch {
			// The store keeps the message; the form shows it below.
		}
	}

	function reset() {
		account.linkSentTo = null;
		account.error = null;
		email = '';
	}

	/** Places offered and not yet answered; nothing is published while they wait. */
	const waiting = $derived(account.leaderboard.pending.length);

	async function signOut() {
		await account.signOut();
		toast('Signed out', {
			description: 'Everything kept in this browser is still here.'
		});
	}
</script>

{#if account.enabled}
	{#if account.signedIn && account.user}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={buttonVariants({ variant, size: 'sm' })}>
				<UserIcon class="size-4" />
				<span class="hidden max-w-[16ch] truncate sm:inline">{account.user.email}</span>
				{#if waiting > 0}
					<span
						class="size-2 rounded-full bg-primary"
						title="{waiting} place{waiting === 1 ? '' : 's'} waiting on you"
					></span>
				{/if}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-56">
				<DropdownMenu.Label class="truncate font-normal text-muted-foreground">
					{account.user.email}
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => goto('/account')}>
					<SettingsIcon class="size-4" />
					Account
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => goto('/leaderboard')}>
					<TrophyIcon class="size-4" />
					Leaderboard
					{#if waiting > 0}
						<Badge variant="secondary" class="ml-auto tabular-nums">{waiting}</Badge>
					{/if}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={signOut}>
					<LogOutIcon class="size-4" />
					Sign out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{:else}
		<Dialog.Root
			bind:open
			onOpenChange={(next) => {
				if (!next) reset();
			}}
		>
			<Dialog.Trigger class={buttonVariants({ variant, size: 'sm' })}>
				<CloudIcon class="size-4" />
				Sign in
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-md">
				{#if account.linkSentTo}
					<Dialog.Header>
						<Dialog.Title>Check your inbox</Dialog.Title>
						<Dialog.Description>
							If {account.linkSentTo} can have an account, a sign-in link is on its way. It works once
							and expires in fifteen minutes.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button variant="outline" onclick={reset}>Use a different address</Button>
						<Button onclick={() => (open = false)}>Done</Button>
					</Dialog.Footer>
				{:else}
					<Dialog.Header>
						<Dialog.Title>Sign in to LogbooX</Dialog.Title>
						<Dialog.Description>
							There is no password. Enter your address and we will send a link.
						</Dialog.Description>
					</Dialog.Header>

					<ul class="space-y-2 text-sm text-muted-foreground">
						{#each benefits as benefit (benefit)}
							<li class="flex gap-2">
								<span class="mt-2 size-1 shrink-0 rounded-full bg-primary"></span>
								{benefit}
							</li>
						{/each}
					</ul>

					<form class="space-y-3" onsubmit={submit}>
						<div class="space-y-2">
							<Label for="account-email">E-mail address</Label>
							<Input
								id="account-email"
								type="email"
								autocomplete="email"
								required
								placeholder="you@example.com"
								bind:value={email}
							/>
						</div>

						{#if account.error}
							<p class="text-sm text-destructive">{account.error}</p>
						{/if}

						<Button type="submit" class="w-full" disabled={account.busy}>
							<MailIcon class="size-4" />
							{account.busy ? 'Sending…' : 'Send me a link'}
						</Button>
					</form>

					<p class="text-xs leading-relaxed text-muted-foreground">
						An account changes nothing about how your export is read: it is still parsed in this
						tab. Nothing is copied to it unless you ask for that. Signing in means accepting the
						<a href="/legal/terms" class="underline underline-offset-4 hover:text-foreground">
							terms
						</a>
						; the
						<a href="/legal/privacy" class="underline underline-offset-4 hover:text-foreground">
							privacy notice
						</a>
						says what an account stores.
					</p>
				{/if}
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}
