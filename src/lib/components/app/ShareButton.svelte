<!--
  Publishing one trip or charging session.

  What travels is a slice: the seconds that journey covers, gzipped the same
  way a kept export is, plus the handful of numbers the page prints above the
  charts. What does not travel is the vehicle identification number, the rest
  of the month, or anything about who made the link.

  Only offered when signed in, because a link has to be revocable and something
  has to own it. Signed out, this says so rather than disappearing.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { api } from '#lib/api/client.js';
	import { account } from '#lib/state/account.svelte.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { exactBuffer } from '#lib/history/codec.js';
	import { encodeSlice, manifestOf, sliceDataset } from '#lib/share/slice.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ShareIcon from '@lucide/svelte/icons/share-2';

	interface Props {
		kind: 'trip' | 'charging';
		startTime: number;
		endTime: number;
		/** The numbers the share page prints; no identifiers among them. */
		meta: Record<string, number | boolean | null>;
	}

	let { kind, startTime, endTime, meta }: Props = $props();

	const noun = $derived(kind === 'trip' ? m.share.trip : m.share.session);
	/** What the slice carries; keep in step with `SHARED_COLUMNS`. */
	const signals = $derived(kind === 'trip' ? m.share.tripSignals : m.share.sessionSignals);

	let open = $state(false);
	let title = $state('');
	let busy = $state(false);
	let url = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function publish() {
		busy = true;
		error = null;
		let createdId: string | null = null;
		try {
			// Cut and compressed before anything is created, so the failures that
			// need no server never leave a row behind.
			// The whole export, not the range on screen: a trip at the edge of a
			// narrowed view would otherwise lose the seconds either side of it.
			const dataset = data.full?.dataset ?? data.dataset;
			if (!dataset) throw new Error(m.share.openFirst);
			const slice = sliceDataset(dataset, kind, startTime, endTime);
			const blobs = await encodeSlice(slice);

			// The manifest travels as a buffer like the rest, so the page needs
			// one request shape rather than two.
			const manifest = exactBuffer(new TextEncoder().encode(JSON.stringify(manifestOf(slice))));

			const created = await api<{ id: string; url: string }>('/api/v1/shares', {
				method: 'POST',
				body: {
					kind,
					vmodel: dataset.vmodel,
					title: title.trim() || undefined,
					startTime,
					endTime,
					timeZone: settings.timeZone,
					meta
				}
			});
			createdId = created.id;

			// The server takes the manifest first, and then only what it lists.
			await upload(created.id, '_manifest', manifest);
			for (const blob of blobs) await upload(created.id, blob.name, blob.bytes);

			url = created.url;
		} catch (failure) {
			error = failure instanceof Error ? failure.message : m.share.failed;
			// A link that shows nothing is worse than none, and a retry would make
			// a second one beside it.
			if (createdId && !(await revoke(createdId))) {
				error += m.share.halfMade;
			}
		} finally {
			busy = false;
		}
	}

	async function revoke(id: string): Promise<boolean> {
		try {
			await api(`/api/v1/shares/${encodeURIComponent(id)}`, { method: 'DELETE' });
			return true;
		} catch {
			return false;
		}
	}

	async function upload(id: string, name: string, bytes: ArrayBuffer) {
		const response = await fetch(
			`/api/v1/shares/${encodeURIComponent(id)}/blobs/${encodeURIComponent(name)}`,
			{
				method: 'PUT',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/octet-stream' },
				body: bytes
			}
		);
		if (!response.ok) throw new Error(m.share.uploadFailed);
	}

	async function copy() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toast(m.share.copied);
		} catch {
			toast(m.share.copyFailed, { description: m.share.copyByHand });
		}
	}

	function reset() {
		open = false;
		url = null;
		error = null;
		title = '';
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(next) => {
		if (!next) reset();
	}}
>
	<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
		<ShareIcon class="size-4" />
		{m.share.share}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		{#if !account.signedIn}
			<Dialog.Header>
				<Dialog.Title>{m.share.signInTitle}</Dialog.Title>
				<Dialog.Description>
					{m.share.signInDetail}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button onclick={reset}>{m.common.close}</Button>
			</Dialog.Footer>
		{:else if url}
			<Dialog.Header>
				<Dialog.Title>{m.share.liveTitle}</Dialog.Title>
				<Dialog.Description>
					{m.share.liveDetail(noun, signals)}
				</Dialog.Description>
			</Dialog.Header>
			<div class="flex gap-2">
				<Input readonly value={url} class="text-xs" />
				<Button variant="outline" size="icon" onclick={copy}>
					<CopyIcon class="size-4" />
					<span class="sr-only">{m.share.copyLink}</span>
				</Button>
			</div>
			<Dialog.Footer>
				<Button onclick={reset}>{m.common.done}</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>{m.share.shareThis(noun)}</Dialog.Title>
				<Dialog.Description>
					{m.share.unguessable}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-2">
				<Label for="share-title">{m.share.titleLabel}</Label>
				<Input id="share-title" placeholder={m.share.titlePlaceholder} bind:value={title} />
			</div>

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}

			<Dialog.Footer>
				<Button variant="outline" onclick={reset}>{m.common.cancel}</Button>
				<Button onclick={publish} disabled={busy}>
					{busy ? m.share.publishing : m.share.make}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
