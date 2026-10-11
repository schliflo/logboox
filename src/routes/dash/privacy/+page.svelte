<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { bytes, maskVin, num } from '#lib/utils/format.js';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { factText } from '#lib/i18n/facts.js';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);

	const accents = ['--viz-8', '--viz-5', '--viz-2', '--viz-4', '--viz-7', '--viz-1'];
</script>

<div class="mx-auto max-w-5xl space-y-6">
	<Card.Root class="overflow-hidden">
		<div
			class="h-1"
			style="background: linear-gradient(90deg, var(--viz-8), var(--viz-5), var(--viz-2))"
		></div>
		<Card.Header>
			<Card.Title class="text-2xl">{m.privacyPage.knows}</Card.Title>
			<Card.Description class="text-base">
				{m.privacyPage.noCoordinate}
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-8 sm:grid-cols-2">
			{#each stats.facts.privacy as fact, index (fact.id)}
				{@const text = factText(fact)}
				<BigStat
					kicker={text.kicker}
					value={text.value}
					unit={text.unit}
					size="sm"
					accent={accents[index % accents.length]}
					detail={text.detail}
				/>
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.privacyPage.identifier}</Card.Title>
			<Card.Description>
				{m.privacyPage.identifierHint}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex flex-wrap items-center gap-3">
				<code class="rounded-md bg-muted px-3 py-2 font-mono text-sm">
					{settings.revealVin ? dataset.vin : maskVin(dataset.vin)}
				</code>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (settings.revealVin = !settings.revealVin)}
				>
					{#if settings.revealVin}
						<EyeOffIcon class="size-4" />
						{m.privacyPage.hide}
					{:else}
						<EyeIcon class="size-4" />
						{m.privacyPage.show}
					{/if}
				</Button>
				<Badge variant="secondary">{m.privacyPage.model(dataset.vmodel)}</Badge>
			</div>
			<p class="text-sm leading-relaxed text-muted-foreground">
				{m.privacyPage.vinDetail(num(dataset.rowsParsed), bytes(dataset.rowsParsed * 18))}
			</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.privacyPage.curiosities}</Card.Title>
			<Card.Description>{m.privacyPage.curiositiesHint}</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-8 sm:grid-cols-2">
			{#each stats.facts.quirk as fact, index (fact.id)}
				{@const text = factText(fact)}
				<BigStat
					kicker={text.kicker}
					value={text.value}
					unit={text.unit}
					size="sm"
					accent={accents[(index + 3) % accents.length]}
					detail={text.detail}
				/>
			{/each}

			{#if dataset.unsortedStreams.length > 0}
				<BigStat
					kicker={m.privacyPage.unsorted}
					value={`${dataset.unsortedStreams.length}`}
					size="sm"
					accent="--viz-2"
					detail={m.privacyPage.unsortedDetail}
				/>
			{/if}

			{#if !dataset.aligned}
				<BigStat
					kicker={m.privacyPage.timelines}
					value={m.privacyPage.merged}
					size="sm"
					accent="--viz-5"
					detail={m.privacyPage.mergedDetail}
				/>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root class="border-primary/30">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ShieldIcon class="size-5 text-primary" />
				{m.privacyPage.handling}
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm leading-relaxed text-muted-foreground">
			<p>
				{m.privacyPage.handlingOne}
			</p>
			<p>
				{#if stats.sources > 1}
					{m.privacyPage.keptMany(num(dataset.time.length))}
				{:else}
					{m.privacyPage.keptOne(num(dataset.time.length))}
				{/if}
				{m.privacyPage.staysHere}
			</p>
			<p>
				{#if stats.sources > 1}
					{m.privacyPage.windowMany(stats.sources, stats.recordedDays)}
				{:else}
					{m.privacyPage.windowOne(stats.windowDays)}
				{/if}
			</p>
		</Card.Content>
	</Card.Root>
</div>
