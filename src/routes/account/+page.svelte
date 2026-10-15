<!--
  The account page.

  Everything an account can do, and everything it is holding, on one screen —
  including the way out. A product that asks for an e-mail address should show
  what it did with it and let it be taken back without an exchange of letters.
-->
<script lang="ts">
	import { localHref, m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import MadeBy from '#lib/components/app/MadeBy.svelte';
	import ApiTokens from '#lib/components/app/ApiTokens.svelte';
	import BoardPlaces from '#lib/components/app/BoardPlaces.svelte';
	import SharedLinks from '#lib/components/app/SharedLinks.svelte';
	import { account } from '#lib/state/account.svelte.js';
	import { ACCOUNTS_ENABLED } from '#lib/features.js';
	import { bytes, dateOnly, percent } from '#lib/utils/format.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	let confirmingDelete = $state(false);
	let deleteConfirmation = $state('');

	const used = $derived(account.storage?.usedBytes ?? 0);
	const quota = $derived(account.storage?.quotaBytes ?? 0);
	const fraction = $derived(quota > 0 ? Math.min(1, used / quota) : 0);

	onMount(async () => {
		await account.refresh();
		if (!account.signedIn) goto(localHref('/'));
	});

	async function setAutoSync(next: boolean) {
		try {
			await account.updateSettings({ autoSync: next });
		} catch {
			toast(m.accountPage.saveFailed, { description: account.error ?? undefined });
		}
	}

	async function setReminder(next: boolean) {
		try {
			await account.updateSettings({ reminderEnabled: next });
		} catch {
			toast(m.accountPage.saveFailed, { description: account.error ?? undefined });
		}
	}

	async function setReminderDays(value: number) {
		if (!Number.isFinite(value)) return;
		try {
			await account.updateSettings({ reminderAfterDays: value });
		} catch {
			toast(m.accountPage.saveFailed, { description: account.error ?? undefined });
		}
	}

	async function remove() {
		try {
			await account.deleteAccount();
			confirmingDelete = false;
			await goto(localHref('/'));
			toast(m.accountPage.deleted, {
				description: m.accountPage.deletedDetail
			});
		} catch (error) {
			toast(m.accountPage.deleteFailed, {
				description: error instanceof Error ? error.message : undefined
			});
		}
	}

	async function signOut() {
		await account.signOut();
		await goto(localHref('/'));
	}
</script>

<Seo title={m.accountPage.title} path="/account" noindex />

<main class="mx-auto min-h-svh max-w-2xl space-y-6 px-6 py-12">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" onclick={() => goto(localHref('/'))}>
			<ArrowLeftIcon class="size-4" />
			{m.accountPage.backToStart}
		</Button>
	</div>

	{#if !ACCOUNTS_ENABLED}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.accountPage.elsewhere}</Card.Title>
				<Card.Description>
					{m.accountPage.elsewhereDetail}
				</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else if account.signedIn && account.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.accountPage.yours}</Card.Title>
				<Card.Description>
					{m.accountPage.signedInAs(account.user.email, dateOnly(account.user.createdAt))}
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<div class="flex items-baseline justify-between text-sm">
						<span class="text-muted-foreground">
							{m.accountPage.exportsKept(account.storage?.exports ?? 0)}
						</span>
						<span class="tabular-nums">
							<!-- `bytes` reads zero as "no figure to give", which is right
							     where a size is unknown and wrong here: an empty account
							     is a fact worth stating. -->
							{used > 0
								? m.accountPage.usedOf(bytes(used), bytes(quota))
								: m.accountPage.nothingYet(bytes(quota))}
						</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-primary transition-[width]"
							style="width: {Math.max(fraction * 100, used > 0 ? 1 : 0)}%"
						></div>
					</div>
					{#if fraction > 0.8}
						<p class="text-xs text-muted-foreground">
							{m.accountPage.nearlyFull(percent(fraction))}
						</p>
					{/if}
				</div>

				<Button variant="outline" size="sm" onclick={signOut}>
					<LogOutIcon class="size-4" />
					{m.accountPage.signOut}
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.accountPage.keeping}</Card.Title>
				<Card.Description>
					{m.accountPage.keepingDetail}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<Label for="auto-sync" class="font-normal">
						{m.accountPage.autoSync}
					</Label>
					<Switch id="auto-sync" checked={account.user.autoSync} onCheckedChange={setAutoSync} />
				</div>
			</Card.Content>
		</Card.Root>

		<BoardPlaces />

		<SharedLinks />

		<ApiTokens />

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.accountPage.reminders}</Card.Title>
				<Card.Description>
					{m.accountPage.remindersDetail}
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between gap-4">
					<Label for="reminder" class="font-normal">{m.accountPage.reminderSwitch}</Label>
					<Switch
						id="reminder"
						checked={account.user.reminderEnabled}
						onCheckedChange={setReminder}
					/>
				</div>

				{#if account.user.reminderEnabled}
					<Separator />
					<div class="space-y-2">
						<Label for="reminder-days">{m.accountPage.reminderDays}</Label>
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
							{m.accountPage.reminderHint}
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>{m.accountPage.deleteTitle}</Card.Title>
				<Card.Description>
					{m.accountPage.deleteDetail}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button variant="outline" size="sm" onclick={() => (confirmingDelete = true)}>
					{m.accountPage.deleteButton}
				</Button>
			</Card.Content>
		</Card.Root>

		<Dialog.Root bind:open={confirmingDelete}>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>{m.accountPage.deleteConfirmTitle(account.user.email)}</Dialog.Title>
					<Dialog.Description>
						{m.accountPage.deleteConfirmDetail}
					</Dialog.Description>
				</Dialog.Header>
				<div class="space-y-2">
					<Label for="confirm-delete"
						>{m.accountPage.typeBefore} <strong>{m.accountPage.confirmWord}</strong>
						{m.accountPage.typeAfter}</Label
					>
					<Input id="confirm-delete" bind:value={deleteConfirmation} autocomplete="off" />
				</div>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (confirmingDelete = false)}
						>{m.accountPage.keepIt}</Button
					>
					<Button
						variant="destructive"
						disabled={deleteConfirmation.trim().toLowerCase() !== m.accountPage.confirmWord}
						onclick={remove}
					>
						{m.accountPage.deleteEverything}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.accountPage.notSignedIn}</Card.Title>
				<Card.Description>{m.accountPage.takingBack}</Card.Description>
			</Card.Header>
		</Card.Root>
	{/if}

	<footer class="flex justify-center pt-4">
		<MadeBy />
	</footer>
</main>
