<!-- The foot of the public pages: authorship, licence, the other pages, language. -->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import MadeBy from './MadeBy.svelte';
	import LocaleSwitch from './LocaleSwitch.svelte';

	const links = $derived([
		{ href: '/features', label: m.site.features },
		{ href: '/faq', label: m.site.faq },
		{ href: '/legal/imprint', label: m.common.imprint },
		{ href: '/legal/privacy', label: m.common.privacy },
		{ href: '/legal/terms', label: m.common.terms }
	]);
</script>

<footer
	class="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-5 text-xs text-muted-foreground sm:px-8 lg:px-12"
>
	<MadeBy />
	<p class="mr-auto">
		{m.landing.openSource}
		<a
			href="https://github.com/schliflo/logboox/blob/main/LICENSE"
			class="underline underline-offset-4 hover:text-foreground"
			target="_blank"
			rel="noreferrer noopener">{m.landing.licence}</a
		>{m.landing.notAffiliated}
	</p>
	{#each links as link (link.href)}
		<a href={link.href} class="underline underline-offset-4 hover:text-foreground">{link.label}</a>
	{/each}
	<LocaleSwitch />
</footer>
