<!--
  The language picker. Each language is named in itself, so it can be found by
  someone who cannot read the current one.

  On a page with an address per language it goes to the other address, which
  then decides the language; elsewhere it switches in place. Either way the
  choice is remembered for the pages that follow it.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		i18n,
		LOCALES,
		m,
		setLocale,
		storeLocale,
		isLocale,
		type Locale
	} from '#lib/i18n/index.svelte.js';
	import { isLocalizedRoute, localizedPath } from '#lib/i18n/paths.js';
	import LanguagesIcon from '@lucide/svelte/icons/languages';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	function choose(next: Locale) {
		if (!isLocalizedRoute(page.route.id)) return setLocale(next);
		storeLocale(next);
		const { pathname, search, hash } = page.url;
		void goto(localizedPath(`${pathname}${search}${hash}`, next), { reset: false });
	}
</script>

<label
	class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors focus-within:text-foreground hover:text-foreground {className}"
>
	<LanguagesIcon class="size-3.5 shrink-0" aria-hidden="true" />
	<span class="sr-only">{m.common.language}</span>
	<select
		class="cursor-pointer appearance-none bg-transparent pr-1 focus-visible:underline focus-visible:outline-none"
		value={i18n.locale}
		onchange={(event) => {
			const next = event.currentTarget.value;
			if (isLocale(next)) choose(next);
		}}
	>
		{#each LOCALES as option (option.code)}
			<option value={option.code} lang={option.code}>{option.label}</option>
		{/each}
	</select>
</label>
