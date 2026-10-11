<!--
  Progress while the export is read.

  A month of telemetry is a few hundred megabytes, so this runs for a few
  seconds and needs to say what it is doing rather than spin silently.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { bytes } from '#lib/utils/format.js';

	const progress = $derived(data.progress);
	const fraction = $derived(
		progress && progress.total > 0 ? Math.min(1, progress.loaded / progress.total) : 0
	);
</script>

<div class="mx-auto w-full max-w-md space-y-4 text-center">
	<div class="space-y-1">
		<p class="text-lg font-medium">
			{progress ? m.progress.phases[progress.phase] : m.progress.gettingStarted}
		</p>
		{#if progress?.part}
			<p class="text-sm text-muted-foreground">
				{m.progress.part(progress.part.index, progress.part.count)}
			</p>
		{:else if progress?.stream}
			<p class="text-sm text-muted-foreground">{m.progress.streams[progress.stream]}</p>
		{/if}
	</div>

	<Progress value={fraction * 100} max={100} />

	{#if progress && progress.phase === 'parsing' && progress.total > 0}
		<p class="text-xs text-muted-foreground tabular-nums">
			{m.progress.bytesOf(bytes(progress.loaded), bytes(progress.total))}
		</p>
	{/if}

	<p class="text-xs text-muted-foreground">
		{m.progress.local}
	</p>
</div>
