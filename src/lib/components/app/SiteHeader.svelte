<!--
  The bar across the top of the public pages: the landing page, features,
  guides and FAQ. Those three fold into the footer on phones, where they do not
  fit. Each link leads to the page in the language being read.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { localHref, m } from '#lib/i18n/index.svelte.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import AccountMenu from './AccountMenu.svelte';
	import LogoMark from './LogoMark.svelte';

	interface Props {
		/** Links of the page's own, before the shared ones. */
		children?: Snippet;
	}

	let { children }: Props = $props();

	const links = $derived([
		{ href: localHref('/features'), label: m.site.features, narrow: false },
		{ href: localHref('/guides'), label: m.site.guides, narrow: false },
		{ href: localHref('/faq'), label: m.site.faq, narrow: false },
		{ href: localHref('/leaderboard'), label: m.landing.leaderboard, narrow: true }
	]);
</script>

<nav class="relative flex items-center gap-2 px-4 py-5 sm:px-8 lg:px-12">
	<a
		href={localHref('/')}
		class="mr-auto flex items-center gap-2.5 text-lg font-semibold tracking-tight"
	>
		<LogoMark size={32} />
		LogbooX
	</a>
	{@render children?.()}
	{#each links as link (link.href)}
		<a
			href={link.href}
			aria-current={page.url.pathname === link.href || page.url.pathname.startsWith(`${link.href}/`)
				? 'page'
				: undefined}
			class="{buttonVariants({
				variant: 'ghost'
			})} font-semibold aria-[current=page]:bg-accent {link.narrow
				? 'max-sm:px-2'
				: 'max-sm:!hidden'}"
		>
			{link.label}
		</a>
	{/each}
	<AccountMenu />
</nav>
