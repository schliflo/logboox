<!--
  The account page.

  Everything an account can do, and everything it is holding, on one screen —
  including the way out. A product that asks for an e-mail address should show
  what it did with it and let it be taken back without an exchange of letters.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import Seo from '$lib/components/app/Seo.svelte';
	import MadeBy from '$lib/components/app/MadeBy.svelte';
	import { account } from '$lib/state/account.svelte';
	import { ACCOUNTS_ENABLED } from '$lib/features';
	import { bytes, dateOnly, percent } from '$lib/utils/format';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	let confirmingDelete = $state(false);
	let deleteConfirmation = $state('');

	const used = $derived(account.storage?.usedBytes ?? 0);
	const quota = $derived(account.storage?.quotaBytes ?? 0);
	const fraction = $derived(quota > 0 ? Math.min(1, used / quota) : 0);

	onMount(async () => {
		await account.refresh();
		if (!account.signedIn) goto('/');
	});

	async function setAutoSync(next: boolean) {
		try {
			await account.updateSettings({ autoSync: next });
		} catch {
			toast('That could not be saved', { description: account.error ?? undefined });
		}
	}

	async function setReminder(next: boolean) {
		try {
			await account.updateSettings({ reminderEnabled: next });
		} catch {
			toast('That could not be saved', { description: account.error ?? undefined });
		}
	}

	async function setReminderDays(value: number) {
		if (!Number.isFinite(value)) return;
		try {
			await account.updateSettings({ reminderAfterDays: value });
		} catch {
			toast('That could not be saved', { description: account.error ?? undefined });
		}
	}

	async function remove() {
		try {
			await account.deleteAccount();
			confirmingDelete = false;
			await goto('/');
			toast('Account deleted', {
				description:
					'Everything kept in the account is gone. What is stored in this browser is untouched.'
			});
		} catch (error) {
			toast('The account could not be deleted', {
				description: error instanceof Error ? error.message : undefined
			});
		}
	}

	async function signOut() {
		await account.signOut();
		await goto('/');
	}
</script>

<Seo title="Account" path="/account" noindex />

<main class="mx-auto min-h-svh max-w-2xl space-y-6 px-6 py-12">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" onclick={() => goto('/')}>
			<ArrowLeftIcon class="size-4" />
			Back to the start
		</Button>
	</div>

	{#if !ACCOUNTS_ENABLED}
		<Card.Root>
			<Card.Header>
				<Card.Title>Accounts live at logboox.app</Card.Title>
				<Card.Description>
					This address serves an older deployment with no account database.
				</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else if account.signedIn && account.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Your account</Card.Title>
				<Card.Description>
					Signed in as {account.user.email} since {dateOnly(account.user.createdAt)}.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<div class="flex items-baseline justify-between text-sm">
						<span class="text-muted-foreground">
							{account.storage?.exports ?? 0}
							{(account.storage?.exports ?? 0) === 1 ? 'export kept' : 'exports kept'}
						</span>
						<span class="tabular-nums">{bytes(used)} of {bytes(quota)}</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-primary transition-[width]"
							style="width: {Math.max(fraction * 100, used > 0 ? 1 : 0)}%"
						></div>
					</div>
					{#if fraction > 0.8}
						<p class="text-xs text-muted-foreground">
							{percent(fraction)} used. Remove an export you no longer need to make room.
						</p>
					{/if}
				</div>

				<Button variant="outline" size="sm" onclick={signOut}>
					<LogOutIcon class="size-4" />
					Sign out
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Keeping exports</Card.Title>
				<Card.Description>
					A copy in the account outlives this browser. Exports are still read here, and still kept
					here.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<Label for="auto-sync" class="font-normal">
						Copy new imports to my account automatically
					</Label>
					<Switch id="auto-sync" checked={account.user.autoSync} onCheckedChange={setAutoSync} />
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Reminders</Card.Title>
				<Card.Description>
					XPeng only ever holds a rolling thirty days. A month nobody asked for cannot be recovered
					later.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between gap-4">
					<Label for="reminder" class="font-normal">E-mail me when a new export is due</Label>
					<Switch
						id="reminder"
						checked={account.user.reminderEnabled}
						onCheckedChange={setReminder}
					/>
				</div>

				{#if account.user.reminderEnabled}
					<Separator />
					<div class="space-y-2">
						<Label for="reminder-days">Remind me after this many days</Label>
						<Input
							id="reminder-days"
							type="number"
							min="7"
							max="29"
							class="w-28"
							value={account.user.reminderAfterDays}
							onchange={(event) => setReminderDays(Number(event.currentTarget.value))}
						/>
						<p class="text-xs text-muted-foreground">
							Counted from where your newest export stops, not from when you imported it.
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>Delete this account</Card.Title>
				<Card.Description>
					Removes the account, every export kept in it and every share link. What is stored in this
					browser stays where it is.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button variant="outline" size="sm" onclick={() => (confirmingDelete = true)}>
					Delete account
				</Button>
			</Card.Content>
		</Card.Root>

		<Dialog.Root bind:open={confirmingDelete}>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Delete {account.user.email}?</Dialog.Title>
					<Dialog.Description>
						This cannot be undone. Back up anything you want to keep first — the copies in this
						browser are not affected.
					</Dialog.Description>
				</Dialog.Header>
				<div class="space-y-2">
					<Label for="confirm-delete">Type <strong>delete</strong> to confirm</Label>
					<Input id="confirm-delete" bind:value={deleteConfirmation} autocomplete="off" />
				</div>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (confirmingDelete = false)}>Keep it</Button>
					<Button
						variant="destructive"
						disabled={deleteConfirmation.trim().toLowerCase() !== 'delete'}
						onclick={remove}
					>
						Delete everything
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Not signed in</Card.Title>
				<Card.Description>Taking you back to the start.</Card.Description>
			</Card.Header>
		</Card.Root>
	{/if}

	<footer class="flex justify-center pt-4">
		<MadeBy />
	</footer>
</main>
