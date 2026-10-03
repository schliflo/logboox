<!--
  The LogbooX mark: the favicon's gradient tile and trace, drawn inline so it
  scales with its box and needs no gradient id that two copies could share.
-->
<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 32, class: className = '' }: Props = $props();
</script>

<span
	class="grid shrink-0 place-items-center {className}"
	style="width: {size}px; height: {size}px; border-radius: {Math.round(
		(size * 15) / 64
	)}px; background: linear-gradient(135deg, #3987e5, #199e70)"
	aria-hidden="true"
>
	<svg viewBox="0 0 64 64" width={size} height={size}>
		<path
			d="M10 42 L23 42 L31 18 L41 42 L54 26"
			fill="none"
			stroke="#fff"
			stroke-width="6.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</span>
