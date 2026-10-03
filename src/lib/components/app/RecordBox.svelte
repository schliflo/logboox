<!--
  What the dashboard is reading, as one record rather than a list of files.

  However many exports went into it, the reader sees how far back it reaches
  and how recent it is. Adding newer data is one click away; which files made
  it up is the data page's business.
-->
<script lang="ts">
	import { data } from '#lib/state/dataset.svelte.js';
	import { dateOnly } from '#lib/utils/format.js';
	import PlusIcon from '@lucide/svelte/icons/plus';

	const loaded = $derived(data.full?.derived ?? data.derived);
	const shared = $derived(data.source.kind === 'shared');

	const label = $derived.by(() => {
		if (shared) return 'Shared with you';
		if (data.isDemo) return 'Demo car';
		return data.dataset?.vmodel || 'Your car';
	});
</script>

{#if loaded}
	<div
		class="flex items-center gap-2 rounded-xl border border-sidebar-border bg-card py-1.5 pr-1.5 pl-3"
	>
		<div class="flex min-w-0 flex-1 flex-col">
			<span class="truncate text-xs text-muted-foreground">
				{label} · since {dateOnly(loaded.startTime)}
			</span>
			<span class="truncate text-sm font-semibold">Up to {dateOnly(loaded.endTime)}</span>
		</div>
		{#if !shared}
			<a
				href="/dash/data"
				class="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				aria-label="Add newer data"
				title="Add newer data"
			>
				<PlusIcon class="size-4" />
			</a>
		{/if}
	</div>
{/if}
