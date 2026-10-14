<!-- The guides, listed: each one a question readers arrive with before they have a file. -->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import { absolute } from '#lib/seo.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	const structuredData = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: m.guidesPage.headline,
			description: m.guidesPage.description,
			...(absolute('/guides') ? { url: absolute('/guides') } : {}),
			mainEntity: {
				'@type': 'ItemList',
				itemListElement: m.guides.map((guide, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					name: guide.headline,
					...(absolute(`/guides/${guide.slug}`) ? { url: absolute(`/guides/${guide.slug}`) } : {})
				}))
			}
		}).replace(/</g, '\\u003c')
	);
</script>

<Seo title={m.guidesPage.title} description={m.guidesPage.description} path="/guides" />

<svelte:head>
	{@html `<script type="application/ld+json">${structuredData}<\/script>`}
</svelte:head>

<header class="max-w-3xl">
	<p class="eyebrow" style="color: var(--viz-3)">{m.guidesPage.eyebrow}</p>
	<h1 class="mt-4 text-4xl leading-[1] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
		{m.guidesPage.headline}
	</h1>
	<p class="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">{m.guidesPage.lede}</p>
</header>

<ul class="mt-14 grid gap-4 sm:grid-cols-2">
	{#each m.guides as guide (guide.slug)}
		<li>
			<a
				href="/guides/{guide.slug}"
				class="group flex h-full flex-col rounded-2xl border bg-card/50 p-6 hover:bg-card"
			>
				<h2 class="text-lg font-semibold tracking-tight text-balance">{guide.headline}</h2>
				<p class="mt-2 mb-5 text-sm leading-relaxed text-pretty text-muted-foreground">
					{guide.description}
				</p>
				<span
					class="mt-auto flex items-center gap-1.5 text-sm font-medium"
					style="color: var(--viz-1)"
				>
					{m.guidesPage.read}
					<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
				</span>
			</a>
		</li>
	{/each}
</ul>
