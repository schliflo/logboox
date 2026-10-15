<!-- The public pages beside the landing page, in the same frame. -->
<script lang="ts">
	import SiteHeader from '#lib/components/app/SiteHeader.svelte';
	import SiteFooter from '#lib/components/app/SiteFooter.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-svh flex-col overflow-hidden">
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
		style="background: radial-gradient(60% 100% at 30% 0%, color-mix(in oklab, var(--viz-1) 20%, transparent), transparent 70%)"
		aria-hidden="true"
	></div>
	<SiteHeader />
	<main class="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-20 sm:px-8 lg:pt-10">
		{@render children()}
	</main>
	<SiteFooter />
</div>
