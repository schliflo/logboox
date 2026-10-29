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
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import MadeBy from '#lib/components/app/MadeBy.svelte';
	import AccountSection from '#lib/components/app/AccountSection.svelte';
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

	const sections = $derived([
		['profile', m.accountPage.yours],
		['keeping', m.accountPage.keepingAndReminders],
		['leaderboard', m.claims.title],
		['links', m.shares.title],
		['tokens', m.tokens.title]
	]);

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

	function cancelDelete() {
		confirmingDelete = false;
		deleteConfirmation = '';
	}

	async function remove() {
		try {
			await account.deleteAccount();
			cancelDelete();
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

<main class="mx-auto min-h-svh max-w-5xl space-y-10 px-4 py-10 sm:px-6 sm:py-12">
	<div class="space-y-4">
		<Button variant="ghost" size="sm" class="-ml-2" onclick={() => goto(localHref('/'))}>
			<ArrowLeftIcon class="size-4" />
			{m.accountPage.backToStart}
		</Button>
		<h1 class="text-2xl font-semibold tracking-tight">{m.accountPage.title}</h1>
		{#if ACCOUNTS_ENABLED && account.signedIn}
			<nav aria-label={m.accountPage.onThisPage} class="-ml-3 flex flex-wrap gap-1">
				{#each sections as [id, label] (id)}
					<Button variant="ghost" size="sm" href="#{id}">{label}</Button>
				{/each}
			</nav>
		{/if}
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
		<AccountSection
			id="profile"
			title={m.accountPage.yours}
			description={m.accountPage.profileDetail}
		>
			<div class="flex flex-wrap items-center gap-4">
				<span
					class="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary uppercase"
					aria-hidden="true">{account.user.email.charAt(0)}</span
				>
				<span class="min-w-0 flex-[1_1_14rem]">
					<span class="block truncate text-base font-semibold">{account.user.email}</span>
					<span class="text-sm text-muted-foreground">
						{m.accountPage.memberSince(dateOnly(account.user.createdAt))}
					</span>
				</span>
				<Button variant="outline" onclick={signOut}>
					<LogOutIcon class="size-4" />
					{m.accountPage.signOut}
				</Button>
			</div>

			<div class="space-y-2.5">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<span class="text-[15px] font-medium">
						{m.accountPage.exportsKept(account.storage?.exports ?? 0)}
					</span>
					<span class="text-sm text-muted-foreground tabular-nums">
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
		</AccountSection>

		<AccountSection
			id="keeping"
			title={m.accountPage.keepingAndReminders}
			description={m.accountPage.remindersDetail}
		>
			<div class="flex items-center gap-4">
				<span class="flex-1">
					<Label for="auto-sync" class="text-[15px] font-medium">{m.accountPage.autoSync}</Label>
					<span class="mt-0.5 block text-sm text-muted-foreground">
						{m.accountPage.keepingDetail}
					</span>
				</span>
				<Switch id="auto-sync" checked={account.user.autoSync} onCheckedChange={setAutoSync} />
			</div>

			<div class="flex items-center gap-4">
				<Label for="reminder" class="flex-1 text-[15px] font-medium">
					{m.accountPage.reminderSwitch}
				</Label>
				<Switch
					id="reminder"
					checked={account.user.reminderEnabled}
					onCheckedChange={setReminder}
				/>
			</div>

			{#if account.user.reminderEnabled}
				<div class="-mx-6 flex flex-wrap items-center gap-4 bg-muted/40 px-6">
					<span class="flex-[1_1_16rem]">
						<Label for="reminder-days" class="font-medium">{m.accountPage.reminderDays}</Label>
						<span class="mt-0.5 block text-sm text-muted-foreground">
							{m.accountPage.reminderHint}
						</span>
					</span>
					<Input
						id="reminder-days"
						type="number"
						min="7"
						max="29"
						class="w-20 tabular-nums"
						value={account.user.reminderAfterDays}
						onchange={(event) => setReminderDays(Number(event.currentTarget.value))}
					/>
				</div>
			{/if}
		</AccountSection>

		<BoardPlaces />

		<SharedLinks />

		<ApiTokens />

		<AccountSection id="delete" title={m.accountPage.deleteTitle} danger>
			<div class="flex flex-wrap items-center gap-4">
				<p class="flex-[1_1_18rem] text-sm leading-relaxed text-muted-foreground">
					{m.accountPage.deleteDetail}
				</p>
				{#if !confirmingDelete}
					<Button
						variant="outline"
						class="border-destructive/40 text-destructive hover:text-destructive"
						onclick={() => (confirmingDelete = true)}
					>
						{m.accountPage.deleteButton}…
					</Button>
				{/if}
			</div>

			{#if confirmingDelete}
				<div class="flex flex-wrap items-end gap-3">
					<div class="flex-[1_1_15rem] space-y-2">
						<Label for="confirm-delete" class="block leading-relaxed font-normal">
							{m.accountPage.typeBefore} <strong>{m.accountPage.confirmWord}</strong>
							{m.accountPage.typeAfter}. {m.accountPage.deleteConfirmDetail}
						</Label>
						<Input id="confirm-delete" bind:value={deleteConfirmation} autocomplete="off" />
					</div>
					<Button variant="outline" onclick={cancelDelete}>{m.accountPage.keepIt}</Button>
					<Button
						variant="destructive"
						disabled={deleteConfirmation.trim().toLowerCase() !== m.accountPage.confirmWord}
						onclick={remove}
					>
						{m.accountPage.deleteEverything}
					</Button>
				</div>
			{/if}
		</AccountSection>
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
