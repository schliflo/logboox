<!--
  Automatic import from XPeng: the owner's Open Platform credentials and where
  fetching stands. Hidden on a deployment that has no credentials of its own.

  The access token goes in and never comes back out: it can be replaced or
  removed, not read.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { api } from '#lib/api/client.js';
	import { dateOnly, dateTime } from '#lib/utils/format.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { updateNow, type UpdateResult, type XpengStatus } from '#lib/state/xpeng.js';

	let status = $state<XpengStatus | null>(null);
	let editing = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let form = $state({ openId: '', accessToken: '', scopeCode: '', enterpriseName: '' });
	let updating = $state<UpdateResult | 'asking' | null>(null);

	async function update() {
		updating = 'asking';
		try {
			const result = await updateNow((progress) => (updating = progress));
			if (result.kind === 'imported') {
				toast(m.xpeng.updateDone, { description: m.xpeng.updateDoneDetail });
			} else if (result.kind === 'exporting' || result.kind === 'busy') {
				toast(m.xpeng.updateLater);
			} else if (result.kind === 'failed' && result.message) {
				toast(m.xpeng.updateFailed, { description: m.xpeng.messages[result.message] });
			}
		} catch (failure) {
			toast(m.xpeng.updateFailed, {
				description: failure instanceof Error ? failure.message : undefined
			});
		} finally {
			updating = null;
			await load();
		}
	}

	onMount(load);

	async function load() {
		try {
			status = await api<XpengStatus>('/api/v1/xpeng');
		} catch {
			status = null;
		}
	}

	function open() {
		form = {
			openId: '',
			accessToken: '',
			scopeCode: '',
			enterpriseName: status?.link?.enterpriseName ?? status?.enterpriseName ?? ''
		};
		error = null;
		editing = true;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			await api('/api/v1/xpeng', {
				method: 'PUT',
				body: { ...form, timeZone: settings.timeZone }
			});
			editing = false;
			toast(m.xpeng.saved, { description: m.xpeng.savedDetail });
			await load();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : m.xpeng.saveFailed;
		} finally {
			busy = false;
		}
	}

	async function disconnect() {
		try {
			await api('/api/v1/xpeng', { method: 'DELETE' });
		} catch (failure) {
			toast(m.xpeng.saveFailed, {
				description: failure instanceof Error ? failure.message : undefined
			});
			return;
		}
		toast(m.xpeng.disconnected, { description: m.xpeng.disconnectedDetail });
		await load();
	}
</script>

{#if status?.available}
	{@const link = status.link}
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.xpeng.title}</Card.Title>
			<Card.Description>{m.xpeng.description}</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			{#if link}
				<p class="text-sm">
					{m.xpeng.connected(dateOnly(link.createdAt))}
					{#if link.fetchedAt}· {m.xpeng.lastFetched(dateOnly(link.fetchedAt))}{/if}
					{#if link.nextAt && link.state === 'waiting'}· {m.xpeng.nextFetch(
							dateOnly(link.nextAt)
						)}{/if}
				</p>
				{#if link.importedTo}
					<p class="text-sm text-muted-foreground">
						{m.xpeng.importedTo(dateOnly(link.importedTo))}
					</p>
				{/if}
				{#if link.state === 'exporting'}
					<p class="text-sm text-muted-foreground">{m.xpeng.exporting}</p>
				{/if}
				{#if link.message}
					<p
						class="text-sm {link.state === 'reauth' ? 'text-destructive' : 'text-muted-foreground'}"
					>
						{m.xpeng.messages[link.message]}
					</p>
				{/if}
			{/if}

			{#if link && status.updatable && link.state !== 'reauth'}
				{@const waitUntil =
					link.updateAfter && link.updateAfter * 1000 > Date.now() ? link.updateAfter : null}
				<div class="space-y-1">
					<Button size="sm" disabled={updating !== null || waitUntil !== null} onclick={update}>
						{updating ? m.xpeng.updating : m.xpeng.update}
					</Button>
					{#if updating && updating !== 'asking' && updating.kind === 'exporting'}
						<p class="text-sm text-muted-foreground">{m.xpeng.updateExporting}</p>
					{:else if waitUntil}
						<p class="text-xs text-muted-foreground">{m.xpeng.updateWait(dateTime(waitUntil))}</p>
					{/if}
				</div>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onclick={open}>
					{link ? m.xpeng.replace : m.xpeng.connect}
				</Button>
				{#if link}
					<Button variant="ghost" size="sm" onclick={disconnect}>{m.xpeng.disconnect}</Button>
				{/if}
			</div>

			<p class="text-xs text-muted-foreground">
				{m.xpeng.guideBefore}
				<a
					class="text-primary underline underline-offset-4"
					href="https://github.com/schliflo/logboox/blob/main/docs/auto-import.md"
					target="_blank"
					rel="noreferrer noopener">docs/auto-import.md</a
				>.
			</p>
		</Card.Content>
	</Card.Root>

	<Dialog.Root bind:open={editing}>
		<Dialog.Content class="sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{m.xpeng.formTitle}</Dialog.Title>
				<Dialog.Description>{m.xpeng.formDetail}</Dialog.Description>
			</Dialog.Header>

			<form class="space-y-3" onsubmit={save}>
				{#each ['openId', 'accessToken', 'scopeCode'] as const as key (key)}
					<div class="space-y-2">
						<Label for="xpeng-{key}">{key}</Label>
						<Input
							id="xpeng-{key}"
							class="font-mono text-xs"
							autocomplete="off"
							spellcheck="false"
							required
							bind:value={form[key]}
						/>
					</div>
				{/each}
				<div class="space-y-2">
					<Label for="xpeng-enterprise">{m.xpeng.enterpriseName}</Label>
					<Input
						id="xpeng-enterprise"
						class="font-mono text-xs"
						autocomplete="off"
						spellcheck="false"
						required
						bind:value={form.enterpriseName}
					/>
				</div>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
				<Button type="submit" disabled={busy} class="w-full">
					{busy ? m.xpeng.saving : m.xpeng.save}
				</Button>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}
