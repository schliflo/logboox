<!--
  One guide: a question about the export answered at length, with the short
  answer first. The structured data names it as an article and repeats its
  questions, so a search engine or an assistant can quote the page directly.
-->
<script lang="ts">
	import { m, intlLocale, i18n, localHref } from '#lib/i18n/index.svelte.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import RichText from '#lib/components/app/RichText.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { plainText } from '#lib/utils/rich-text.js';
	import { AUTHOR, AUTHOR_URL, GUIDES_UPDATED, SITE_NAME, SITE_URL, absolute } from '#lib/seo.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let { data } = $props();

	const guide = $derived(m.guides.find((item) => item.slug === data.slug)!);
	const others = $derived(m.guides.filter((item) => item.slug !== data.slug));
	/** The English path, which `Seo` turns into this language's. */
	const path = $derived(`/guides/${data.slug}`);
	const url = $derived(absolute(localHref(path)));
	const updated = $derived(
		new Date(GUIDES_UPDATED).toLocaleDateString(intlLocale(), { dateStyle: 'long' })
	);

	const structuredData = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'TechArticle',
					headline: guide.headline,
					description: guide.description,
					abstract: guide.summary.map(plainText).join(' '),
					inLanguage: i18n.locale,
					dateModified: GUIDES_UPDATED,
					author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
					publisher: {
						'@type': 'Organization',
						name: SITE_NAME,
						...(SITE_URL ? { url: SITE_URL } : {})
					},
					about: [
						{ '@type': 'Thing', name: 'EU Data Act' },
						{ '@type': 'Brand', name: 'XPeng' }
					],
					...(url ? { url, mainEntityOfPage: url } : {}),
					...(absolute('/og.png') ? { image: absolute('/og.png') } : {})
				},
				{
					'@type': 'BreadcrumbList',
					itemListElement: [
						{ name: m.guidesPage.home, path: '/' },
						{ name: m.guidesPage.title, path: '/guides' },
						{ name: guide.title, path }
					].map((crumb, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						name: crumb.name,
						...(absolute(localHref(crumb.path)) ? { item: absolute(localHref(crumb.path)) } : {})
					}))
				},
				{
					'@type': 'FAQPage',
					mainEntity: guide.faq.map((item) => ({
						'@type': 'Question',
						name: item.q,
						acceptedAnswer: { '@type': 'Answer', text: plainText(item.a) }
					}))
				}
			]
		}).replace(/</g, '\\u003c')
	);
</script>

<Seo
	title={guide.title}
	description={guide.description}
	{path}
	ogType="article"
	modified={GUIDES_UPDATED}
	cardTitle={guide.headline}
/>

<svelte:head>
	{@html `<script type="application/ld+json">${structuredData}<\/script>`}
</svelte:head>

<nav aria-label="Breadcrumb" class="text-sm text-muted-foreground">
	<ol class="flex flex-wrap items-center gap-1.5">
		<li><a href={localHref('/')} class="hover:text-foreground">{m.guidesPage.home}</a></li>
		<li aria-hidden="true"><ChevronRightIcon class="size-3.5" /></li>
		<li>
			<a href={localHref('/guides')} class="hover:text-foreground">{m.guidesPage.title}</a>
		</li>
		<li aria-hidden="true"><ChevronRightIcon class="size-3.5" /></li>
		<li aria-current="page" class="text-foreground">{guide.title}</li>
	</ol>
</nav>

<article class="mt-8">
	<header class="max-w-3xl">
		<p class="eyebrow" style="color: var(--viz-3)">{m.guidesPage.eyebrow}</p>
		<h1
			class="mt-4 text-4xl leading-[1.05] font-extrabold tracking-[-0.04em] text-balance sm:text-5xl"
		>
			{guide.headline}
		</h1>
		<p class="mt-5 text-lg text-pretty text-muted-foreground">{guide.lede}</p>
		<p class="mt-4 text-sm text-muted-foreground">
			{m.guidesPage.updated} <time datetime={GUIDES_UPDATED}>{updated}</time>
		</p>
	</header>

	<div class="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
		<div class="max-w-3xl min-w-0">
			<section
				aria-labelledby="in-brief"
				class="rounded-2xl border p-6"
				style="background: radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, var(--viz-1) 14%, transparent), transparent 60%), var(--card)"
			>
				<h2 id="in-brief" class="eyebrow">{m.guidesPage.inBrief}</h2>
				{#each guide.summary as paragraph, p (p)}
					<p class="mt-3 leading-relaxed text-pretty"><RichText text={paragraph} /></p>
				{/each}
			</section>

			{#each guide.sections as section, s (s)}
				<section id="section-{s}" class="mt-12 scroll-mt-6" aria-labelledby="section-{s}-title">
					<h2 id="section-{s}-title" class="text-2xl font-semibold tracking-tight">
						{section.heading}
					</h2>
					<div class="mt-4 space-y-4 leading-relaxed text-pretty text-muted-foreground">
						{#each section.body as paragraph, p (p)}
							<p><RichText text={paragraph} /></p>
						{/each}
						{#if section.list}
							<svelte:element
								this={section.ordered ? 'ol' : 'ul'}
								class="space-y-2.5 pl-6 {section.ordered ? 'list-decimal' : 'list-disc'}"
							>
								{#each section.list as item, i (i)}
									<li class="pl-1"><RichText text={item} /></li>
								{/each}
							</svelte:element>
						{/if}
					</div>
				</section>
			{/each}

			<section id="questions" class="mt-14 scroll-mt-6" aria-labelledby="questions-title">
				<h2 id="questions-title" class="text-2xl font-semibold tracking-tight">
					{m.guidesPage.questions}
				</h2>
				<dl class="mt-4 divide-y rounded-2xl border bg-card/50">
					{#each guide.faq as item, i (i)}
						<div class="px-5 py-4">
							<dt class="font-medium">{item.q}</dt>
							<dd class="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
								<RichText text={item.a} />
							</dd>
						</div>
					{/each}
				</dl>
			</section>
		</div>

		<aside class="max-lg:hidden">
			<nav class="sticky top-6" aria-labelledby="contents">
				<h2 id="contents" class="eyebrow">{m.guidesPage.contents}</h2>
				<ul class="mt-3 space-y-2 text-sm">
					{#each guide.sections as section, s (s)}
						<li>
							<a href="#section-{s}" class="text-muted-foreground hover:text-foreground"
								>{section.heading}</a
							>
						</li>
					{/each}
					<li>
						<a href="#questions" class="text-muted-foreground hover:text-foreground"
							>{m.guidesPage.questions}</a
						>
					</li>
				</ul>
			</nav>
		</aside>
	</div>
</article>

<section class="mt-20" aria-labelledby="more-guides">
	<h2 id="more-guides" class="text-xl font-semibold tracking-tight">{m.guidesPage.more}</h2>
	<ul class="mt-5 grid gap-4 sm:grid-cols-3">
		{#each others as other (other.slug)}
			<li>
				<a
					href={localHref(`/guides/${other.slug}`)}
					class="group flex h-full flex-col rounded-2xl border bg-card/50 p-5 hover:bg-card"
				>
					<span class="font-semibold">{other.title}</span>
					<span class="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground"
						>{other.lede}</span
					>
				</a>
			</li>
		{/each}
	</ul>
</section>

<section
	class="mt-16 rounded-2xl border p-6 sm:p-10"
	style="background: radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, var(--viz-1) 18%, transparent), transparent 60%), var(--card)"
>
	<h2 class="text-2xl font-bold tracking-tight">{m.guidesPage.ctaTitle}</h2>
	<p class="mt-2 max-w-xl text-muted-foreground">{m.guidesPage.ctaBody}</p>
	<div class="mt-6">
		<Button href={localHref('/')} size="lg" class="h-11 px-5">
			{m.site.readExport}
			<ArrowRightIcon class="size-4" />
		</Button>
	</div>
</section>
