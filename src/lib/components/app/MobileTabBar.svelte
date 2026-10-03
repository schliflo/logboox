<!--
  The phone's way around: the five areas under the thumb, instead of a menu
  behind a button. Hidden once the sidebar has room to stay open.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { CAR_AREAS, DATA, areaFor } from '#lib/navigation.js';

	const items = [...CAR_AREAS, DATA];
	const current = $derived(areaFor(page.url.pathname)?.id ?? null);
</script>

<nav
	aria-label="Sections"
	class="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
>
	{#each items as item (item.id)}
		<a
			href={item.href}
			aria-current={current === item.id ? 'page' : undefined}
			class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors aria-[current=page]:text-foreground"
		>
			<item.icon class="size-5" />
			{item.short}
		</a>
	{/each}
</nav>
