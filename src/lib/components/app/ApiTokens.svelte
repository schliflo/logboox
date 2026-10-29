<!--
  Tokens for reading one's own data.

  The secret is shown exactly once, at the moment it is made, and the copy
  offered there is the only one there will be — the server keeps a hash and the
  last four characters, which is enough to tell two tokens apart in a list and
  not enough to use either.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import AccountSection from '#lib/components/app/AccountSection.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { api } from '#lib/api/client.js';
	import { dateOnly } from '#lib/utils/format.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import KeyIcon from '@lucide/svelte/icons/key-round';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface TokenRow {
		id: string;
		name: string;
		hint: string;
		scopes: string[];
		createdAt: number;
		lastUsedAt: number | null;
	}

	// null: not loaded. Never shown as "none", since tokens may still work.
	let tokens = $state<TokenRow[] | null>(null);
	let creating = $state(false);
	let name = $state('');
	let busy = $state(false);
	let issued = $state<string | null>(null);
	let error = $state<string | null>(null);

	onMount(load);

	async function load() {
		try {
			tokens = (await api<{ tokens: TokenRow[] }>('/api/v1/tokens')).tokens;
		} catch {
			tokens = null;
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			const created = await api<{ token: string }>('/api/v1/tokens', {
				method: 'POST',
				body: { name }
			});
			issued = created.token;
			name = '';
			await load();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : m.tokens.createFailed;
		} finally {
			busy = false;
		}
	}

	async function revoke(row: TokenRow) {
		try {
			await api(`/api/v1/tokens/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
		} catch (error) {
			toast(m.tokens.revokeFailed, {
				description: error instanceof Error ? error.message : m.tokens.stillWorks,
				closeButton: true
			});
			return;
		}
		await load();
		toast(m.tokens.revoked, { description: m.tokens.revokedDetail(row.name) });
	}

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast(m.tokens.copied);
		} catch {
			toast(m.tokens.copyFailed, { description: m.tokens.copyByHand });
		}
	}

	function close() {
		creating = false;
		issued = null;
		error = null;
		name = '';
	}
</script>

<AccountSection id="tokens" title={m.tokens.title} description={m.tokens.description}>
	{#if tokens}
		{#each tokens as token (token.id)}
			<div class="flex flex-wrap items-center gap-3">
				<KeyIcon class="size-4 shrink-0 text-muted-foreground" />
				<div class="min-w-32 flex-1">
					<p class="text-[15px] font-medium">{token.name}</p>
					<p class="text-sm text-muted-foreground">
						<code>lbx_…{token.hint}</code>
						· {m.tokens.made(dateOnly(token.createdAt))}
						{#if token.lastUsedAt}
							· {m.tokens.lastUsed(dateOnly(token.lastUsedAt))}
						{:else}
							· {m.tokens.neverUsed}
						{/if}
					</p>
				</div>
				<Badge variant="secondary">{token.scopes.join(', ')}</Badge>
				<Button
					variant="ghost"
					size="icon"
					class="text-destructive hover:text-destructive"
					onclick={() => revoke(token)}
				>
					<TrashIcon class="size-4" />
					<span class="sr-only">{m.tokens.revoke(token.name)}</span>
				</Button>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">{m.tokens.none}</p>
		{/each}
	{/if}

	<div class="flex flex-wrap items-center gap-4">
		<p class="flex-[1_1_16rem] text-sm text-muted-foreground">
			{m.tokens.readOnlyBefore}
			<a
				class="text-primary underline underline-offset-4"
				href="https://github.com/schliflo/logboox/blob/main/docs/api.md"
				target="_blank"
				rel="noreferrer noopener">docs/api.md</a
			>.
		</p>
		<Button variant="outline" onclick={() => (creating = true)}>
			<PlusIcon class="size-4" />
			{m.tokens.newToken}
		</Button>
	</div>
</AccountSection>

<Dialog.Root
	bind:open={creating}
	onOpenChange={(next) => {
		if (!next) close();
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		{#if issued}
			<Dialog.Header>
				<Dialog.Title>{m.tokens.copyNow}</Dialog.Title>
				<Dialog.Description>
					{m.tokens.onlyOnce}
				</Dialog.Description>
			</Dialog.Header>

			<div class="flex gap-2">
				<Input readonly value={issued} class="font-mono text-xs" />
				<Button variant="outline" size="icon" onclick={() => copy(issued!)}>
					<CopyIcon class="size-4" />
					<span class="sr-only">{m.tokens.copyToken}</span>
				</Button>
			</div>

			<Dialog.Footer>
				<Button onclick={close}>{m.common.done}</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>{m.tokens.newTitle}</Dialog.Title>
				<Dialog.Description>
					{m.tokens.newDetail}
				</Dialog.Description>
			</Dialog.Header>

			<form class="space-y-3" onsubmit={create}>
				<div class="space-y-2">
					<Label for="token-name">{m.tokens.name}</Label>
					<Input
						id="token-name"
						placeholder={m.tokens.namePlaceholder}
						required
						bind:value={name}
					/>
				</div>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
				<Button type="submit" disabled={busy} class="w-full">
					{busy ? m.tokens.creating : m.tokens.create}
				</Button>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
