<!--
  The language picker. Each language is named in itself, so it can be found by
  someone who cannot read the current one.
-->
<script lang="ts">
	import { i18n, LOCALES, m, setLocale, isLocale } from '#lib/i18n/index.svelte.js';
	import LanguagesIcon from '@lucide/svelte/icons/languages';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
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
			if (isLocale(next)) setLocale(next);
		}}
	>
		{#each LOCALES as option (option.code)}
			<option value={option.code} lang={option.code}>{option.label}</option>
		{/each}
	</select>
</label>
