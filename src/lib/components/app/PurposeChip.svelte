<!--
  A trip's logbook purpose, in the colour it has everywhere in the app. Without
  one, a dashed "Label" asks for it.
-->
<script lang="ts" module>
	import type { Purpose } from '#lib/logbook/types.js';

	export const PURPOSE_COLOR: Record<Purpose, string> = {
		business: 'var(--viz-1)',
		commute: 'var(--viz-2)',
		private: 'var(--viz-7)'
	};
</script>

<script lang="ts">
	import { PURPOSES } from '#lib/logbook/types.js';

	interface Props {
		purpose?: Purpose | '' | null;
		class?: string;
	}

	let { purpose, class: className = '' }: Props = $props();
</script>

{#if purpose}
	{@const color = PURPOSE_COLOR[purpose]}
	<span
		class="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap {className}"
		style="color: {color}; background: color-mix(in oklab, {color} 16%, transparent)"
	>
		{PURPOSES.find((option) => option.value === purpose)?.label}
	</span>
{:else}
	<span
		class="rounded-full border border-dashed px-2.5 py-px text-xs font-semibold whitespace-nowrap {className}"
		style="color: var(--viz-2); border-color: color-mix(in oklab, var(--viz-2) 70%, transparent)"
	>
		Label
	</span>
{/if}
