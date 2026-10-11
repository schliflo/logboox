<!--
  What stands out on a page, said before its charts.

  The same observations the opening sequence makes, picked by the page they
  point to, so each section leads with an answer in words and the charts
  below are there to check it against.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { page } from '$app/state';
	import { data } from '#lib/state/dataset.svelte.js';
	import { factText } from '#lib/i18n/facts.js';

	const ACCENTS = ['--viz-4', '--viz-1', '--viz-3'];
	/** Spelled out, so Tailwind sees every class it has to generate. */
	const COLUMNS = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3'];

	const facts = $derived.by(() => {
		const derived = data.derived;
		if (!derived) return [];
		// Headlines are totals the page already shows as numbers; habits and
		// oddities are what a chart alone would not say.
		const all = [...derived.facts.habit, ...derived.facts.quirk, ...derived.facts.privacy];
		return all.filter((fact) => fact.href === page.url.pathname).slice(0, 3);
	});
</script>

{#if facts.length}
	<section aria-label={m.findings.whatStandsOut} class="grid gap-4 {COLUMNS[facts.length]}">
		{#each facts as fact, index (fact.id)}
			{@const text = factText(fact)}
			<div
				class="flex flex-col gap-2 rounded-2xl border p-5 sm:p-6"
				style="background: radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var({ACCENTS[
					index
				]}) 14%, transparent), transparent 60%), var(--card)"
			>
				<span class="eyebrow">{text.kicker}</span>
				<span class="flex flex-wrap items-baseline gap-x-2">
					<span
						class="text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-4xl"
						style="color: var({ACCENTS[index]})">{text.value}</span
					>
					{#if text.unit}<span class="text-sm font-medium text-muted-foreground">{text.unit}</span
						>{/if}
				</span>
				<p class="text-sm leading-relaxed text-muted-foreground">{text.detail}</p>
			</div>
		{/each}
	</section>
{/if}
