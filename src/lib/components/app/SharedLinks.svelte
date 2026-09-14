<!--
  Links this account has published, and how to take one down.

  A share that cannot be found again cannot be revoked, which would make
  "revocable" a claim rather than a feature. So every link is listed here with
  what it shows and how often it has been opened.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { api } from '$lib/api/client';
	import { dateOnly } from '$lib/utils/format';
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

	const KIND_LABELS: Record<ShareRow['kind'], string> = {
		trip: 'Trip',
		charging: 'Charging',
		export: 'Whole export'
	};

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
		await api(`/api/v1/shares/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
		await load();
		toast('Link revoked', { description: 'It stops working for everyone immediately.' });
	}

	async function copy(row: ShareRow) {
		try {
			await navigator.clipboard.writeText(row.url);
			toast('Link copied');
		} catch {
			toast('Could not copy');
		}
	}
</script>

{#if shares.length > 0}
	<Card.Root>
		<Card.Header>
			<Card.Title>Shared links</Card.Title>
			<Card.Description>
				Anyone with one of these can see what it shows. None of them carries your vehicle
				identification number.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="divide-y rounded-lg border">
				{#each shares as share (share.id)}
					<li class="flex flex-wrap items-center gap-3 p-3">
						<LinkIcon class="size-4 shrink-0 text-muted-foreground" />
						<div class="min-w-32 flex-1">
							<p class="text-sm font-medium">
								{share.title || `${KIND_LABELS[share.kind]} on ${dateOnly(share.startTime)}`}
							</p>
							<p class="text-xs text-muted-foreground">
								Made {dateOnly(share.createdAt)} ·
								{share.views === 1 ? 'opened once' : `opened ${share.views} times`}
							</p>
						</div>
						<Badge variant="secondary">{KIND_LABELS[share.kind]}</Badge>
						<Button variant="ghost" size="icon" onclick={() => copy(share)}>
							<CopyIcon class="size-4" />
							<span class="sr-only">Copy this link</span>
						</Button>
						<Button variant="ghost" size="icon" onclick={() => revoke(share)}>
							<TrashIcon class="size-4" />
							<span class="sr-only">Revoke this link</span>
						</Button>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
{/if}
