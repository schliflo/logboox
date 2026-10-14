<script lang="ts">
	import './layout.css';
	import 'uplot/dist/uPlot.min.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import OfflineSupport from '#lib/components/app/OfflineSupport.svelte';
	import MovedPage from '#lib/components/app/MovedPage.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { restoreLocale } from '#lib/i18n/index.svelte.js';
	import {
		AUTHOR,
		AUTHOR_URL,
		MOVED_TO,
		SITE_DESCRIPTION,
		SITE_NAME,
		SITE_URL,
		absolute
	} from '#lib/seo.js';

	let { children } = $props();

	// A superseded deployment is export-only: every page but the legal ones
	// becomes the pointer at the new address.
	const superseded = $derived(MOVED_TO && !page.url.pathname.startsWith('/legal'));

	// After hydration, so the prerendered English and the first client render agree.
	onMount(restoreLocale);

	// Describes the app to search engines as what it is: a free, install-free
	// tool that runs in the browser. Serialised here because Svelte will not
	// take a nested <script> tag in markup.
	const structuredData = JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebApplication',
				name: SITE_NAME,
				alternateName: 'XPeng Data Export Browser',
				description: SITE_DESCRIPTION,
				applicationCategory: 'UtilitiesApplication',
				applicationSubCategory: 'Vehicle data viewer',
				operatingSystem: 'Any browser',
				browserRequirements: 'Requires JavaScript and Web Workers',
				inLanguage: ['en', 'de'],
				isAccessibleForFree: true,
				license: 'https://opensource.org/licenses/MIT',
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
				featureList: [
					'Reads the XPeng EU Data Act export (CSV or ZIP) in the browser, without uploading it',
					'Trips second by second: speed, power and state of charge',
					'Charging sessions with energy integrated from pack voltage and current',
					'Battery standby drain and real-world range',
					'Driving style g-g diagram',
					'Driving logbook draft as PDF, spreadsheet or CSV',
					'Combines monthly exports into one continuous record',
					'Works offline'
				],
				about: { '@type': 'Brand', name: 'XPeng' },
				author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
				sameAs: ['https://github.com/schliflo/logboox'],
				...(SITE_URL ? { url: SITE_URL } : {}),
				...(absolute('/og.png') ? { image: absolute('/og.png') } : {})
			},
			{
				'@type': 'WebSite',
				name: SITE_NAME,
				description: SITE_DESCRIPTION,
				inLanguage: ['en', 'de'],
				publisher: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
				...(SITE_URL ? { url: SITE_URL } : {})
			}
		]
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="color-scheme" content="dark light" />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121215" />
	<meta name="author" content={AUTHOR} />
	<meta name="application-name" content={SITE_NAME} />
	{@html `<script type="application/ld+json">${structuredData}<\/script>`}
</svelte:head>

<!-- Dark by default: the charts were stepped for a dark surface first. -->
<ModeWatcher defaultMode="dark" />
<!-- Lifted on phones, clear of the dashboard's tab bar. -->
<Toaster mobileOffset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }} />
<OfflineSupport />

{#if superseded}
	<MovedPage />
{:else}
	{@render children()}
{/if}
