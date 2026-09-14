<!--
  The pages that have to exist once an app stops being only a file reader.

  A narrow column, the same chrome on each, and links between them: somebody
  arriving from a footer link should be able to find the other two without
  going back.
-->
<script lang="ts">
	import MadeBy from '$lib/components/app/MadeBy.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	const pages = [
		{ href: '/legal/imprint', label: 'Imprint' },
		{ href: '/legal/privacy', label: 'Privacy' },
		{ href: '/legal/terms', label: 'Terms' }
	];
</script>

<main class="mx-auto min-h-svh max-w-2xl px-6 py-12">
	<header class="mb-10 space-y-4">
		<a href="/" class="flex items-center gap-2 text-sm font-medium hover:opacity-80">
			<img src="/favicon.svg" alt="" width="24" height="24" class="size-6" />
			LogbooX
		</a>
		<nav class="flex flex-wrap gap-4 text-sm">
			{#each pages as item (item.href)}
				<a
					href={item.href}
					class="underline-offset-4 hover:underline {page.url.pathname === item.href
						? 'font-medium'
						: 'text-muted-foreground'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<article
		class="space-y-6 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-medium [&_h3]:pt-2 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:text-pretty [&_ul]:space-y-1"
	>
		{@render children()}
	</article>

	<footer class="mt-16 flex justify-center border-t pt-8">
		<MadeBy />
	</footer>
</main>
