<!--
  A medal as the badges draw it: a rim, a metal face, and the board's icon
  struck into it in a shade dark enough to read on that metal.
-->
<script lang="ts">
	import BoardIcon from './BoardIcon.svelte';
	import { METALS, type Medal } from '#lib/leaderboard/medals.js';
	import type { BoardId } from '#lib/leaderboard/boards.js';

	interface Props {
		medal: Medal;
		board: BoardId;
		size?: number;
		glow?: boolean;
	}

	let { medal, board, size = 72, glow = false }: Props = $props();
	const metal = $derived(METALS[medal]);
	const face = $derived(Math.round(size * 0.86));
</script>

<span
	class="grid shrink-0 place-items-center rounded-full"
	style="width: {size}px; height: {size}px; background: linear-gradient(135deg, {metal.rim}, {metal.dark}); {glow
		? `box-shadow: 0 8px 32px color-mix(in oklab, ${metal.light} 30%, transparent)`
		: ''}"
	role="img"
	aria-label="{metal.name} medal"
>
	<span
		class="grid place-items-center rounded-full"
		style="width: {face}px; height: {face}px; background: linear-gradient(135deg, {metal.light}, {metal.dark}); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.35); color: {metal.ink}"
	>
		<BoardIcon {board} size={Math.round(size * 0.4)} />
	</span>
</span>
