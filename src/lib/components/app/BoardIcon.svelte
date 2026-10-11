<!-- A board's icon, from the same nodes the server draws onto badges. -->
<script lang="ts">
	import { BOARD_ICONS } from '#lib/leaderboard/icons.js';
	import type { BoardId } from '#lib/leaderboard/boards.js';

	interface Props {
		board: BoardId;
		size?: number;
		class?: string;
	}

	let { board, size = 16, class: className = '' }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="shrink-0 {className}"
	aria-hidden="true"
>
	{#each BOARD_ICONS[board] as [tag, attrs], index (index)}
		<svelte:element this={tag} xmlns="http://www.w3.org/2000/svg" {...attrs} />
	{/each}
</svg>
