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

	/** The same colours as text on their own tint, darkened (or lightened) only as far as contrast needs. */
	export const PURPOSE_TEXT: Record<Purpose, string> = {
		business: 'color-mix(in oklab, var(--viz-1) 80%, var(--foreground))',
		commute: 'color-mix(in oklab, var(--viz-2) 70%, var(--foreground))',
		private: 'var(--viz-7)'
	};
</script>

<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
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
		style="color: {PURPOSE_TEXT[
			purpose
		]}; background: color-mix(in oklab, {color} 16%, transparent)"
	>
		{PURPOSES.find((option) => option.value === purpose)?.label}
	</span>
{:else}
	<span
		class="rounded-full border border-dashed px-2.5 py-px text-xs font-semibold whitespace-nowrap {className}"
		style="color: color-mix(in oklab, var(--viz-2) 70%, var(--foreground)); border-color: color-mix(in oklab, var(--viz-2) 70%, transparent)"
	>
		{m.purpose.label}
	</span>
{/if}
