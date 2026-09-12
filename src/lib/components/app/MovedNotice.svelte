<!--
  The notice a superseded deployment shows.

  Set `PUBLIC_MOVED_TO` on a Worker and this appears at the top of its start
  page: the app has a new address, and the exports kept in this browser —
  stored per origin, so invisible from the new one — can be written out here
  and dropped in there. Everywhere else it renders nothing.
-->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { history } from '$lib/state/history.svelte';
	import { MOVED_TO, SITE_NAME } from '$lib/seo';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import SignpostIcon from '@lucide/svelte/icons/signpost';

	/** The address as people would say it, without the scheme. */
	const host = MOVED_TO.replace(/^https?:\/\//, '');

	const kept = $derived(history.entries.length > 0);

	async function backup() {
		try {
			await history.backup(history.entries.map((entry) => entry.id));
		} catch (error) {
			toast('The backup could not be written', {
				description: error instanceof Error ? error.message : 'Something went wrong.',
				closeButton: true
			});
		}
	}
</script>

{#if MOVED_TO}
	<div
		class="mb-10 flex gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-left"
		role="status"
	>
		<SignpostIcon class="mt-0.5 size-5 shrink-0 text-primary" />
		<div class="min-w-0 flex-1 space-y-3">
			<div class="space-y-1 text-sm">
				<p class="font-medium">{SITE_NAME} has moved to {host}</p>
				<p class="text-muted-foreground">
					{#if kept}
						This address will not be updated again. The exports kept in this browser stay here, so
						back them up first, then drop the file onto the start page at the new address to carry
						them over.
					{:else}
						This address will not be updated again; everything from here on happens at the new
						address.
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if kept}
					<Button variant="secondary" size="sm" disabled={history.busy} onclick={backup}>
						<DownloadIcon class="size-4" />
						Back up everything
					</Button>
				{/if}
				<Button size="sm" href={MOVED_TO}>
					Open {host}
					<ArrowRightIcon class="size-4" />
				</Button>
			</div>
		</div>
	</div>
{/if}
