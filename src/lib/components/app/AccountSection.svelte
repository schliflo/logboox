<!--
  One section of the account page: what it is on the left, its rows on the
  right. Each direct child of the card is a row; rows are divided by a rule.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { cn } from '#lib/utils.js';

	let {
		id,
		title,
		description,
		danger = false,
		children
	}: {
		id: string;
		title: string;
		description?: string;
		danger?: boolean;
		children: Snippet;
	} = $props();
</script>

<section
	{id}
	aria-labelledby="{id}-title"
	class="flex scroll-mt-6 flex-wrap items-start gap-x-12 gap-y-4"
>
	<div class="max-w-xs flex-[1_1_15rem]">
		<h2
			id="{id}-title"
			class={cn('text-lg font-semibold tracking-tight', danger && 'text-destructive')}
		>
			{title}
		</h2>
		{#if description}
			<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
		{/if}
	</div>
	<Card.Root
		class={cn(
			'min-w-0 flex-[3_1_32rem] gap-0 divide-y px-6 py-0 *:py-4',
			danger && 'ring-destructive/40'
		)}
	>
		{@render children()}
	</Card.Root>
</section>
