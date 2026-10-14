<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import Seo from '#lib/components/app/Seo.svelte';
	import RichText from '#lib/components/app/RichText.svelte';
	import { plainText } from '#lib/utils/rich-text.js';
	import { absolute } from '#lib/seo.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	const CONTACT = 'info@logboox.app';

	/** Lets search engines show the answers as rich results. */
	const structuredData = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: m.faqPage.groups.flatMap((group) =>
				group.items.map((item) => ({
					'@type': 'Question',
					name: item.q,
					acceptedAnswer: { '@type': 'Answer', text: item.a.map(plainText).join('\n\n') }
				}))
			),
			...(absolute('/faq') ? { url: absolute('/faq') } : {})
		}).replace(/</g, '\\u003c')
	);
</script>

<Seo title={m.faqPage.title} description={m.faqPage.description} path="/faq" />

<svelte:head>
	{@html `<script type="application/ld+json">${structuredData}<\/script>`}
</svelte:head>

<header class="max-w-3xl">
	<p class="eyebrow" style="color: var(--viz-3)">{m.faqPage.eyebrow}</p>
	<h1 class="mt-4 text-4xl leading-[1] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
		{m.faqPage.headline}
	</h1>
	<p class="mt-5 text-lg text-muted-foreground">
		{m.faqPage.lede}
		{m.faqPage.contact}
		<a href="mailto:{CONTACT}" class="underline underline-offset-4" style="color: var(--viz-1)"
			>{CONTACT}</a
		>.
	</p>
</header>

<div class="mt-14 grid gap-x-12 gap-y-12 lg:grid-cols-[12rem_minmax(0,1fr)]">
	<nav class="max-lg:hidden" aria-label={m.faqPage.title}>
		<ul class="sticky top-6 space-y-2 text-sm">
			{#each m.faqPage.groups as group, g (g)}
				<li>
					<a href="#faq-{g}" class="text-muted-foreground hover:text-foreground">{group.title}</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="max-w-3xl space-y-12">
		{#each m.faqPage.groups as group, g (g)}
			<section id="faq-{g}" class="scroll-mt-6" aria-labelledby="faq-{g}-title">
				<h2 id="faq-{g}-title" class="text-xl font-semibold tracking-tight">{group.title}</h2>
				<div class="mt-4 divide-y rounded-2xl border bg-card/50">
					{#each group.items as item, i (i)}
						<details class="group px-5">
							<summary
								class="flex cursor-pointer list-none items-center gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden"
							>
								<span class="mr-auto">{item.q}</span>
								<ChevronDownIcon
									class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
									aria-hidden="true"
								/>
							</summary>
							<div class="space-y-3 pb-5 text-sm leading-relaxed text-pretty text-muted-foreground">
								{#each item.a as paragraph, p (p)}
									<p><RichText text={paragraph} /></p>
								{/each}
							</div>
						</details>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
