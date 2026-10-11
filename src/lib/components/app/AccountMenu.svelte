<!--
  Signing in, where it is offered at all.

  Optional by design: the app has always worked without an account and still
  does, so this is a quiet control rather than a wall. What an account adds is
  named in the dialog, because "sign in" on a page that promises nothing is
  uploaded deserves an explanation before an address is typed into it.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { account } from '#lib/state/account.svelte.js';
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

	const benefits = $derived(m.accountMenu.benefits);

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
		toast(m.accountMenu.signedOut, {
			description: m.accountMenu.signedOutDetail
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
					<span class="size-2 rounded-full bg-primary" title={m.accountMenu.placesWaiting(waiting)}
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
					{m.accountMenu.account}
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => goto('/leaderboard')}>
					<TrophyIcon class="size-4" />
					{m.accountMenu.leaderboard}
					{#if waiting > 0}
						<Badge variant="secondary" class="ml-auto tabular-nums">{waiting}</Badge>
					{/if}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={signOut}>
					<LogOutIcon class="size-4" />
					{m.accountMenu.signOut}
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
				{m.accountMenu.signIn}
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-md">
				{#if account.linkSentTo}
					<Dialog.Header>
						<Dialog.Title>{m.accountMenu.checkInbox}</Dialog.Title>
						<Dialog.Description>
							{m.accountMenu.linkSent(account.linkSentTo)}
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button variant="outline" onclick={reset}>{m.accountMenu.differentAddress}</Button>
						<Button onclick={() => (open = false)}>{m.common.done}</Button>
					</Dialog.Footer>
				{:else}
					<Dialog.Header>
						<Dialog.Title>{m.accountMenu.title}</Dialog.Title>
						<Dialog.Description>
							{m.accountMenu.noPassword}
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
							<Label for="account-email">{m.accountMenu.email}</Label>
							<Input
								id="account-email"
								type="email"
								autocomplete="email"
								required
								placeholder={m.accountMenu.emailPlaceholder}
								bind:value={email}
							/>
						</div>

						{#if account.error}
							<p class="text-sm text-destructive">{account.error}</p>
						{/if}

						<Button type="submit" class="w-full" disabled={account.busy}>
							<MailIcon class="size-4" />
							{account.busy ? m.accountMenu.sending : m.accountMenu.sendLink}
						</Button>
					</form>

					<p class="text-xs leading-relaxed text-muted-foreground">
						{m.accountMenu.smallPrintBefore}
						<a href="/legal/terms" class="underline underline-offset-4 hover:text-foreground"
							>{m.accountMenu.smallPrintTerms}</a
						>{m.accountMenu.smallPrintMiddle}
						<a href="/legal/privacy" class="underline underline-offset-4 hover:text-foreground"
							>{m.accountMenu.smallPrintPrivacy}</a
						>
						{m.accountMenu.smallPrintAfter}
					</p>
				{/if}
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}
