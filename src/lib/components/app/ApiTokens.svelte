<!--
  Tokens for reading one's own data.

  The secret is shown exactly once, at the moment it is made, and the copy
  offered there is the only one there will be — the server keeps a hash and the
  last four characters, which is enough to tell two tokens apart in a list and
  not enough to use either.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { api } from '$lib/api/client';
	import { dateOnly } from '$lib/utils/format';
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

	let tokens = $state<TokenRow[]>([]);
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
			tokens = [];
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
			error = failure instanceof Error ? failure.message : 'The token could not be created.';
		} finally {
			busy = false;
		}
	}

	async function revoke(row: TokenRow) {
		await api(`/api/v1/tokens/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
		await load();
		toast('Token revoked', { description: `${row.name} stopped working immediately.` });
	}

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast('Copied');
		} catch {
			toast('Could not copy', { description: 'Select the token and copy it by hand.' });
		}
	}

	function close() {
		creating = false;
		issued = null;
		error = null;
		name = '';
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>API access</Card.Title>
		<Card.Description>
			Read your own trips, charging sessions and the car's last known state — from Home Assistant, a
			script, or anything else that can send a header.
		</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-4">
		{#if tokens.length > 0}
			<ul class="divide-y rounded-lg border">
				{#each tokens as token (token.id)}
					<li class="flex flex-wrap items-center gap-3 p-3">
						<KeyIcon class="size-4 shrink-0 text-muted-foreground" />
						<div class="min-w-32 flex-1">
							<p class="text-sm font-medium">{token.name}</p>
							<p class="text-xs text-muted-foreground">
								<code>lbx_…{token.hint}</code>
								· made {dateOnly(token.createdAt)}
								{#if token.lastUsedAt}
									· last used {dateOnly(token.lastUsedAt)}
								{:else}
									· never used
								{/if}
							</p>
						</div>
						<Badge variant="secondary">{token.scopes.join(', ')}</Badge>
						<Button variant="ghost" size="icon" onclick={() => revoke(token)}>
							<TrashIcon class="size-4" />
							<span class="sr-only">Revoke {token.name}</span>
						</Button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">No tokens yet.</p>
		{/if}

		<Button variant="outline" size="sm" onclick={() => (creating = true)}>
			<PlusIcon class="size-4" />
			New token
		</Button>

		<p class="text-xs text-muted-foreground">
			A token reads; it cannot change anything, and it cannot make another token. The API is
			documented in
			<a
				class="text-primary underline underline-offset-4"
				href="https://github.com/schliflo/logboox/blob/main/docs/api.md"
				target="_blank"
				rel="noreferrer noopener">docs/api.md</a
			>.
		</p>
	</Card.Content>
</Card.Root>

<Dialog.Root
	bind:open={creating}
	onOpenChange={(next) => {
		if (!next) close();
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		{#if issued}
			<Dialog.Header>
				<Dialog.Title>Copy it now</Dialog.Title>
				<Dialog.Description>
					This is the only time it is shown. If it is lost, revoke it and make another.
				</Dialog.Description>
			</Dialog.Header>

			<div class="flex gap-2">
				<Input readonly value={issued} class="font-mono text-xs" />
				<Button variant="outline" size="icon" onclick={() => copy(issued!)}>
					<CopyIcon class="size-4" />
					<span class="sr-only">Copy the token</span>
				</Button>
			</div>

			<Dialog.Footer>
				<Button onclick={close}>Done</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>New API token</Dialog.Title>
				<Dialog.Description>
					Name it after whatever will hold it, so a revoked one is the right one.
				</Dialog.Description>
			</Dialog.Header>

			<form class="space-y-3" onsubmit={create}>
				<div class="space-y-2">
					<Label for="token-name">Name</Label>
					<Input id="token-name" placeholder="Home Assistant" required bind:value={name} />
				</div>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
				<Button type="submit" disabled={busy} class="w-full">
					{busy ? 'Creating…' : 'Create token'}
				</Button>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
