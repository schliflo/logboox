<!--
  The data itself, and who holds it.

  The record is shown as one thing that reaches back so far and is current to
  a day, with the months it covers drawn as a strip, because that is what
  matters to the reader: how far back, how recent, and what is missing. The
  files it was made from are folded away underneath. Preferences that change
  every figure on the dashboard live here too, rather than behind a gear.
-->
<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import ExportLibrary from '#lib/components/app/ExportLibrary.svelte';
	import AccountMenu from '#lib/components/app/AccountMenu.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { account } from '#lib/state/account.svelte.js';
	import { history } from '#lib/state/history.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { ACCOUNTS_ENABLED } from '#lib/features.js';
	import { monthLabel } from '#lib/leaderboard/periods.js';
	import { EXPORT_WINDOW_DAYS } from '#lib/data/range.js';
	import { dateOnly, maskVin, num } from '#lib/utils/format.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	const loaded = $derived(data.full?.derived ?? data.derived);
	const shared = $derived(data.source.kind === 'shared');
	const distance = $derived(loaded ? loaded.days.reduce((sum, day) => sum + day.distanceKm, 0) : 0);

	/** Every calendar month the record touches, and how much of it was recorded. */
	const months = $derived.by(() => {
		if (!loaded) return [];
		const byMonth = new Map<string, { days: number; covered: number }>();
		for (const day of loaded.days) {
			const key = day.date.slice(0, 7);
			const entry = byMonth.get(key) ?? { days: 0, covered: 0 };
			entry.days++;
			if (day.covered) entry.covered++;
			byMonth.set(key, entry);
		}
		return [...byMonth.entries()].map(([month, { days, covered }]) => ({
			month,
			label: monthLabel(month),
			share: days > 0 ? covered / days : 0
		}));
	});

	/** The last day XPeng will still hand over what follows this record. */
	const requestBy = $derived(loaded ? loaded.endTime + EXPORT_WINDOW_DAYS * 86_400 : null);
	const lapsed = $derived(requestBy !== null && requestBy * 1000 < Date.now());

	let input = $state<HTMLInputElement>();

	function add(list: FileList | null) {
		const files = [...(list ?? [])].filter((file) => /\.(csv|zip)$/i.test(file.name));
		if (files.length) void data.extend(files);
	}
</script>

<div class="mx-auto max-w-4xl space-y-12">
	{#if !shared && loaded}
		<section aria-labelledby="record" class="space-y-4">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div class="space-y-1">
					<h2 id="record" class="text-xl font-semibold tracking-tight">Your record</h2>
					<p class="text-sm text-muted-foreground">
						Everything you add joins one timeline. Overlaps and duplicates are handled for you.
					</p>
				</div>
				<input
					bind:this={input}
					type="file"
					multiple
					accept=".csv,.zip"
					class="sr-only"
					aria-label="Add newer data"
					onchange={(event) => {
						add(event.currentTarget.files);
						// So that picking the same files again still counts as a pick.
						event.currentTarget.value = '';
					}}
				/>
				<Button onclick={() => input?.click()}>
					<PlusIcon class="size-4" />
					Add newer data
				</Button>
			</div>

			<Card.Root>
				<Card.Content class="space-y-6">
					<dl class="flex flex-wrap gap-x-10 gap-y-4">
						<div>
							<dt class="eyebrow">Recorded</dt>
							<dd
								class="text-3xl font-bold tracking-tight tabular-nums"
								style="color: var(--viz-1)"
							>
								{num(loaded.recordedDays)} days
							</dd>
						</div>
						<div>
							<dt class="eyebrow">Trips</dt>
							<dd
								class="text-3xl font-bold tracking-tight tabular-nums"
								style="color: var(--viz-3)"
							>
								{num(loaded.trips.length)}
							</dd>
						</div>
						<div>
							<dt class="eyebrow">Distance</dt>
							<dd
								class="text-3xl font-bold tracking-tight tabular-nums"
								style="color: var(--viz-4)"
							>
								{num(distance)} km
							</dd>
						</div>
					</dl>

					<div
						role="img"
						aria-label="Months covered: {months
							.map((m) => `${m.label}, ${Math.round(m.share * 100)}%`)
							.join('; ')}"
						class="grid gap-1.5"
						style="grid-template-columns: repeat({Math.max(months.length, 1)}, minmax(0, 1fr))"
					>
						{#each months as month (month.month)}
							<div class="flex min-w-0 flex-col gap-1.5">
								<span class="h-3.5 overflow-hidden rounded bg-muted">
									<span
										class="block h-full rounded"
										style="width: {Math.round(
											month.share * 100
										)}%; background: linear-gradient(90deg, color-mix(in oklab, var(--viz-1) 55%, transparent), var(--viz-1))"
									></span>
								</span>
								<span class="truncate text-xs text-muted-foreground">{month.label}</span>
							</div>
						{/each}
					</div>

					{#if !data.isDemo}
						<div class="flex flex-wrap items-center gap-3 border-t pt-4">
							<p class="flex-1 text-sm text-muted-foreground">
								{#if lapsed}
									XPeng keeps only thirty days, so what came after {dateOnly(loaded.endTime)} is no longer
									available. Request a new export to start the next stretch.
								{:else if requestBy}
									XPeng keeps only thirty days. Request the next export before {dateOnly(requestBy)}
									and the record stays unbroken.
								{/if}
							</p>
							<a
								href="https://www.xpeng.com/data-act"
								target="_blank"
								rel="noreferrer noopener"
								class={buttonVariants({ variant: 'outline', size: 'sm' })}
							>
								Request at XPeng
								<ArrowUpRightIcon class="size-4" />
							</a>
						</div>
					{/if}

					{#if history.count > 0}
						<details class="group border-t pt-4">
							<summary
								class="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
							>
								<ChevronRightIcon class="size-4 transition-transform group-open:rotate-90" />
								Imported files ({history.count})
							</summary>
							<ExportLibrary />
						</details>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>
	{/if}

	<section aria-labelledby="prefs" class="space-y-4">
		<h2 id="prefs" class="text-xl font-semibold tracking-tight">Preferences</h2>
		<Card.Root class="py-0">
			<Card.Content class="divide-y px-6">
				<div class="flex flex-wrap items-center gap-4 py-5">
					<div class="min-w-60 flex-1">
						<Label for="price" class="text-[15px]">Electricity price</Label>
						<p class="text-sm text-muted-foreground">Used for every cost on the dashboard.</p>
					</div>
					<div class="flex items-center gap-2">
						<Input
							id="price"
							type="number"
							step="0.01"
							min="0"
							class="w-28 tabular-nums"
							bind:value={settings.pricePerKwh}
						/>
						<span class="text-sm text-muted-foreground">per kWh</span>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-4 py-5">
					<div class="min-w-60 flex-1">
						<Label for="tz" class="text-[15px]">Time zone</Label>
						<p class="text-sm text-muted-foreground">
							Days and hours are shown in your own zone. The export's date column is cut at midnight
							in Beijing, so it is ignored.
						</p>
					</div>
					<Input id="tz" value={settings.timeZone} readonly class="w-56 font-mono text-xs" />
				</div>
				{#if !shared}
					<div class="flex flex-wrap items-center gap-4 py-5">
						<div class="min-w-60 flex-1">
							<Label for="vin" class="text-[15px]">Show the full VIN</Label>
							<p class="text-sm text-muted-foreground">
								Hidden by default, so screenshots are safe to share.
								<span class="font-mono text-xs">
									{settings.revealVin ? data.dataset?.vin : maskVin(data.dataset?.vin ?? '')}
								</span>
							</p>
						</div>
						<Switch id="vin" bind:checked={settings.revealVin} />
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</section>

	{#if ACCOUNTS_ENABLED}
		<section aria-labelledby="account" class="space-y-4">
			<div class="space-y-1">
				<h2 id="account" class="text-xl font-semibold tracking-tight">Account</h2>
				<p class="text-sm text-muted-foreground">Optional. Everything above works without one.</p>
			</div>
			<Card.Root class="py-0">
				<Card.Content class="divide-y px-6">
					{#if account.signedIn && account.user}
						<div class="flex flex-wrap items-center gap-4 py-5">
							<div class="min-w-60 flex-1">
								<p class="text-[15px] font-medium">{account.user.email}</p>
								<p class="text-sm text-muted-foreground">
									Keeps copies, sends reminders, shares trips and serves your data over an API.
								</p>
							</div>
						</div>
						{#each [{ href: '/account', title: 'Copies and reminders', body: 'What the account holds, automatic copying, and when to remind you.' }, { href: '/account#leaderboard', title: 'Your leaderboard places', body: 'Put your name to a place, or take it back down.' }, { href: '/account#links', title: 'Shared links and API tokens', body: 'What is public at its own link, and the keys your scripts use.' }] as link (link.href)}
							<a
								href={link.href}
								class="-mx-6 flex items-center gap-4 px-6 py-5 transition-colors hover:bg-accent/50"
							>
								<span class="flex-1">
									<span class="block text-[15px] font-medium">{link.title}</span>
									<span class="text-sm text-muted-foreground">{link.body}</span>
								</span>
								<ChevronRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/each}
					{:else}
						<div class="flex flex-wrap items-center gap-4 py-5">
							<p class="min-w-60 flex-1 text-sm text-muted-foreground">
								Sign in with a link by e-mail to keep a copy that outlives this browser, get a
								reminder before XPeng's thirty days run out, and put a place on the leaderboard.
								Nothing is copied unless you ask.
							</p>
							<AccountMenu />
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>
	{/if}
</div>
