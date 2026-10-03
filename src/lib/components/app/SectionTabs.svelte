<!--
  The pages an area gathers, as tabs under its title. Each is a real link, so
  a tab can be opened in a new window and the address always says where you are.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { areaFor } from '#lib/navigation.js';

	const area = $derived(areaFor(page.url.pathname));
	const tabs = $derived(area && area.tabs.length > 1 ? area.tabs : []);
</script>

{#if tabs.length}
	<nav aria-label="{area?.label} sections" class="-mb-px flex gap-1 overflow-x-auto">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				aria-current={page.url.pathname === tab.href || page.url.pathname.startsWith(`${tab.href}/`)
					? 'page'
					: undefined}
				class="shrink-0 border-b-2 border-transparent px-3 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none aria-[current=page]:border-[var(--viz-1)] aria-[current=page]:text-foreground"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
{/if}
