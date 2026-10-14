<!--
  A paragraph from the catalogs with its links made live.

  Copy is kept as plain strings so it translates as one piece; the markup it
  may carry is described in `rich-text.ts`. Links leaving the site open in a
  new tab.
-->
<script lang="ts">
	import { parseRichText } from '#lib/utils/rich-text.js';

	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	const parts = $derived(parseRichText(text));
</script>

{#each parts as part, i (i)}{#if part.kind === 'link'}{#if part.href.startsWith('/')}<a
				href={part.href}
				class="underline underline-offset-4"
				style="color: var(--viz-1)">{part.text}</a
			>{:else}<a
				href={part.href}
				target="_blank"
				rel="noreferrer noopener"
				class="underline underline-offset-4"
				style="color: var(--viz-1)">{part.text}</a
			>{/if}{:else if part.kind === 'code'}<code
			class="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-all text-foreground"
			>{part.text}</code
		>{:else}{part.text}{/if}{/each}
