<!--
  Per-page metadata.

  One component so every route describes itself the same way: a title, a
  description, what a crawler should do with the page, and the card a link
  preview will build. Only the landing page is worth indexing — the dashboard
  and the highlights deck render nothing until a file has been dropped in, so
  they ask to be left out of the index while staying crawlable.

  A shared trip and a leaderboard month are the pages whose cards say something
  of their own: they override the title, the description and the image, and the
  image is drawn on demand from what the page shows. Everything else keeps the
  site's card. Nothing drawn this way carries a vehicle identification number,
  an odometer or an e-mail address — a link travels further than the person who
  pasted it expects, and a card is the part of it strangers see.

  The public pages exist in every language (`#lib/i18n/paths.ts`). On those,
  `path` is the English one: the canonical link points at the page in its own
  language, and the alternates name every version of it, English as the
  default. Pages with a single address get neither.
-->
<script lang="ts">
	import {
		absolute,
		OG_IMAGE,
		OG_IMAGE_ALT,
		SITE_DESCRIPTION,
		SITE_NAME,
		pageTitle
	} from '#lib/seo.js';
	import { page } from '$app/state';
	import { i18n, m, type Locale } from '#lib/i18n/index.svelte.js';
	import { isLocalizedRoute, localizedPath } from '#lib/i18n/paths.js';

	const OG_LOCALES: Record<Locale, string> = { en: 'en_GB', de: 'de_DE' };

	interface Props {
		/** Page title without the site name; omit for the landing page. */
		title?: string;
		description?: string;
		/** Route path, used for the canonical link; the English one on a translated page. */
		path?: string;
		/** Pages that are empty without a loaded export ask not to be indexed. */
		noindex?: boolean;
		/** What a link preview should say, when it differs from the page title. */
		cardTitle?: string;
		cardDescription?: string;
		/** An absolute URL, for a page that is not where it was prerendered. */
		canonicalUrl?: string;
		/** A card image of this page's own, absolute or root-relative. */
		image?: string;
		/** What that image shows, for a reader who cannot see it. */
		imageAlt?: string;
		/** `article` for the guides, with the date they were last revised. */
		ogType?: 'website' | 'article';
		modified?: string;
	}

	let {
		title,
		description = SITE_DESCRIPTION,
		path = '/',
		noindex = false,
		cardTitle,
		cardDescription,
		canonicalUrl,
		image: ownImage,
		imageAlt: ownImageAlt,
		ogType = 'website',
		modified
	}: Props = $props();

	const fullTitle = $derived(pageTitle(title, m.site.tagline));
	const translated = $derived(isLocalizedRoute(page.route.id));
	const canonical = $derived(
		canonicalUrl ?? absolute(translated ? localizedPath(path, i18n.locale) : path)
	);
	/** Every language's version of a translated page, absolute; empty otherwise. */
	const alternates = $derived.by(() => {
		if (!translated || canonicalUrl) return [];
		const en = absolute(localizedPath(path, 'en'));
		const de = absolute(localizedPath(path, 'de'));
		if (!en || !de) return [];
		return [
			{ hreflang: 'en', href: en },
			{ hreflang: 'de', href: de },
			{ hreflang: 'x-default', href: en }
		];
	});
	const image = $derived(ownImage ?? absolute(OG_IMAGE) ?? OG_IMAGE);
	const imageDescription = $derived(ownImage ? (ownImageAlt ?? cardTitle ?? '') : OG_IMAGE_ALT);
	const cardHeading = $derived(cardTitle ?? fullTitle);
	const cardBody = $derived(cardDescription ?? description);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<meta
		name="robots"
		content={noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}
	/>
	{#if canonical}
		<link rel="canonical" href={canonical} />
	{/if}
	{#each alternates as alternate (alternate.hreflang)}
		<link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
	{/each}

	<meta property="og:type" content={ogType} />
	{#if ogType === 'article' && modified}
		<meta property="article:modified_time" content={modified} />
	{/if}
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={cardHeading} />
	<meta property="og:description" content={cardBody} />
	<meta property="og:locale" content={OG_LOCALES[i18n.locale]} />
	{#if translated}
		{#each Object.entries(OG_LOCALES) as [code, tag] (code)}
			{#if code !== i18n.locale}
				<meta property="og:locale:alternate" content={tag} />
			{/if}
		{/each}
	{/if}
	{#if canonical}
		<meta property="og:url" content={canonical} />
	{/if}
	<meta property="og:image" content={image} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={cardHeading} />
	<meta name="twitter:description" content={cardBody} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={imageDescription} />
</svelte:head>
