<!--
  File intake.

  Accepts the CSVs loose or the ZIP exactly as XPeng delivers it, and a backup
  of exports kept earlier. Nothing is uploaded: the files are handed to a worker
  in this tab and read there.
-->
<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { bytes } from '#lib/utils/format.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import FileIcon from '@lucide/svelte/icons/file-spreadsheet';

	let dragging = $state(false);
	let input = $state<HTMLInputElement>();
	let picked = $state<File[]>([]);

	function accept(list: FileList | null) {
		if (!list) return;
		picked = [...list].filter((file) => /\.(csv|zip)$/i.test(file.name));
		if (picked.length) data.load(picked);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		accept(event.dataTransfer?.files ?? null);
	}
</script>

<div
	class={[
		'relative rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors sm:py-12',
		dragging
			? 'border-[var(--viz-1)] bg-[color-mix(in_oklab,var(--viz-1)_8%,var(--card))]'
			: 'border-border bg-card hover:border-[color-mix(in_oklab,var(--viz-1)_50%,transparent)]'
	]}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
	role="region"
	aria-label="Drop your export files here"
>
	<input
		bind:this={input}
		type="file"
		multiple
		accept=".csv,.zip"
		class="sr-only"
		onchange={(e) => accept(e.currentTarget.files)}
	/>

	<div class="flex flex-col items-center gap-4">
		<div
			class="grid size-14 place-items-center rounded-2xl"
			style="color: var(--viz-1); background: color-mix(in oklab, var(--viz-1) 18%, transparent)"
		>
			<UploadIcon class="size-6" />
		</div>

		<div class="space-y-2">
			<p class="text-xl font-semibold tracking-tight">Drop the ZIP or the CSV files here</p>
			<p class="text-sm text-muted-foreground">
				All parts at once is fine. We sort and join them. Backups made here work too.
			</p>
		</div>

		<Button onclick={() => input?.click()} size="lg" class="h-11 px-5">Choose files</Button>

		{#if picked.length}
			<ul class="mt-2 space-y-1 text-left text-xs text-muted-foreground">
				{#each picked as file (file.name)}
					<li class="flex items-center gap-2">
						<FileIcon class="size-3.5 shrink-0" />
						<span class="truncate">{file.name}</span>
						<span class="tabular-nums">{bytes(file.size)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
