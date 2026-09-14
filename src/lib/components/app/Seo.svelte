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
-->
<script lang="ts">
	import {
		absolute,
		OG_IMAGE,
		OG_IMAGE_ALT,
		SITE_DESCRIPTION,
		SITE_NAME,
		pageTitle
	} from '$lib/seo';

	interface Props {
		/** Page title without the site name; omit for the landing page. */
		title?: string;
		description?: string;
		/** Route path, used for the canonical link. */
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
		imageAlt: ownImageAlt
	}: Props = $props();

	const fullTitle = $derived(pageTitle(title));
	const canonical = $derived(canonicalUrl ?? absolute(path));
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

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={cardHeading} />
	<meta property="og:description" content={cardBody} />
	<meta property="og:locale" content="en_GB" />
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
