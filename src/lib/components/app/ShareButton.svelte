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
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { api } from '$lib/api/client';
	import { account } from '$lib/state/account.svelte';
	import { data } from '$lib/state/dataset.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { encodeSlice, manifestOf, sliceDataset } from '$lib/share/slice';
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

	let open = $state(false);
	let title = $state('');
	let busy = $state(false);
	let url = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function publish() {
		busy = true;
		error = null;
		try {
			const created = await api<{ id: string; url: string }>('/api/v1/shares', {
				method: 'POST',
				body: {
					kind,
					vmodel: data.dataset?.vmodel ?? '',
					title: title.trim() || undefined,
					startTime,
					endTime,
					timeZone: settings.timeZone,
					meta
				}
			});

			const slice = sliceDataset(data.dataset!, startTime, endTime);
			const blobs = await encodeSlice(slice);

			// The manifest travels as a buffer like the rest, so the page needs
			// one request shape rather than two.
			const manifest = new TextEncoder().encode(JSON.stringify(manifestOf(slice)));
			await upload(created.id, '_manifest', manifest.buffer as ArrayBuffer);
			for (const blob of blobs) await upload(created.id, blob.name, blob.bytes);

			url = created.url;
		} catch (failure) {
			error = failure instanceof Error ? failure.message : 'The link could not be made.';
		} finally {
			busy = false;
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
		if (!response.ok) throw new Error('Part of the share could not be uploaded.');
	}

	async function copy() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toast('Link copied');
		} catch {
			toast('Could not copy', { description: 'Select the link and copy it by hand.' });
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
		Share
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		{#if !account.signedIn}
			<Dialog.Header>
				<Dialog.Title>Sign in to share</Dialog.Title>
				<Dialog.Description>
					A link has to belong to an account, so that you can take it down again.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button onclick={reset}>Close</Button>
			</Dialog.Footer>
		{:else if url}
			<Dialog.Header>
				<Dialog.Title>Anyone with this link can see it</Dialog.Title>
				<Dialog.Description>
					It shows the {kind === 'trip' ? 'trip' : 'charging session'} and the model of the car. Not the
					vehicle identification number, and nothing else from your export. Revoke it any time from your
					account.
				</Dialog.Description>
			</Dialog.Header>
			<div class="flex gap-2">
				<Input readonly value={url} class="text-xs" />
				<Button variant="outline" size="icon" onclick={copy}>
					<CopyIcon class="size-4" />
					<span class="sr-only">Copy the link</span>
				</Button>
			</div>
			<Dialog.Footer>
				<Button onclick={reset}>Done</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>Share this {kind === 'trip' ? 'trip' : 'charging session'}</Dialog.Title>
				<Dialog.Description>
					A copy of these seconds is published at a link only someone you give it to can guess.
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-2">
				<Label for="share-title">Title, if you like</Label>
				<Input id="share-title" placeholder="The long way home" bind:value={title} />
			</div>

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}

			<Dialog.Footer>
				<Button variant="outline" onclick={reset}>Cancel</Button>
				<Button onclick={publish} disabled={busy}>
					{busy ? 'Publishing…' : 'Make a link'}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
