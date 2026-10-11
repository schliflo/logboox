<!--
  Links this account has published, and how to take one down.

  A share that cannot be found again cannot be revoked, which would make
  "revocable" a claim rather than a feature. So every link is listed here with
  what it shows and how often it has been opened.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { api } from '#lib/api/client.js';
	import { dateOnly } from '#lib/utils/format.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import LinkIcon from '@lucide/svelte/icons/link';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface ShareRow {
		id: string;
		url: string;
		kind: 'trip' | 'charging' | 'export';
		title: string | null;
		startTime: number;
		views: number;
		createdAt: number;
	}

	const KIND_LABELS = $derived(m.shares.kinds);

	let shares = $state<ShareRow[]>([]);

	onMount(load);

	async function load() {
		try {
			shares = (await api<{ shares: ShareRow[] }>('/api/v1/shares')).shares;
		} catch {
			shares = [];
		}
	}

	async function revoke(row: ShareRow) {
		try {
			await api(`/api/v1/shares/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
		} catch (error) {
			toast(m.shares.revokeFailed, {
				description: error instanceof Error ? error.message : m.shares.stillLive,
				closeButton: true
			});
			return;
		}
		await load();
		toast(m.shares.revoked, { description: m.shares.revokedDetail });
	}

	async function copy(row: ShareRow) {
		try {
			await navigator.clipboard.writeText(row.url);
			toast(m.shares.copied);
		} catch {
			toast(m.shares.copyFailed);
		}
	}
</script>

{#if shares.length > 0}
	<Card.Root id="links">
		<Card.Header>
			<Card.Title>{m.shares.title}</Card.Title>
			<Card.Description>
				{m.shares.description}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="divide-y rounded-lg border">
				{#each shares as share (share.id)}
					<li class="flex flex-wrap items-center gap-3 p-3">
						<LinkIcon class="size-4 shrink-0 text-muted-foreground" />
						<div class="min-w-32 flex-1">
							<p class="text-sm font-medium">
								{share.title || m.shares.kindOn(KIND_LABELS[share.kind], dateOnly(share.startTime))}
							</p>
							<p class="text-xs text-muted-foreground">
								{m.shares.made(dateOnly(share.createdAt))} ·
								{m.shares.views(share.views)}
							</p>
						</div>
						<Badge variant="secondary">{KIND_LABELS[share.kind]}</Badge>
						<Button variant="ghost" size="icon" onclick={() => copy(share)}>
							<CopyIcon class="size-4" />
							<span class="sr-only">{m.shares.copy}</span>
						</Button>
						<Button variant="ghost" size="icon" onclick={() => revoke(share)}>
							<TrashIcon class="size-4" />
							<span class="sr-only">{m.shares.revoke}</span>
						</Button>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
{/if}
