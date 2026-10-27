<!--
  Every export this reader can open.

  Each one can be reopened on its own, and several from the same vehicle can be
  opened as a single timeline — the only way to see more than the thirty days
  any one export covers.

  An export is kept in this browser, in the signed-in account, or in both, and
  each row says which. Only a copy that is here can be opened, so one that
  exists solely in the account is fetched down first; the button says so rather
  than hiding the difference.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { api } from '#lib/api/client.js';
	import { data } from '#lib/state/dataset.svelte.js';
	import { account } from '#lib/state/account.svelte.js';
	import { history, type LibraryEntry, type VehicleGroup } from '#lib/state/history.svelte.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { bytes, dateOnly, distance, maskVin, num } from '#lib/utils/format.js';
	import CarIcon from '@lucide/svelte/icons/car';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import CloudDownloadIcon from '@lucide/svelte/icons/cloud-download';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	/** Above this, a merged timeline is worth warning about before it is built. */
	const VERY_HEAVY = 1024 * 1024 * 1024;

	let confirmingClear = $state(false);

	onMount(() => {
		history.refresh();
	});

	// The account is resolved by a request that lands after this list has
	// already read local storage, so the account's own exports have to be asked
	// for again once there is an account to ask about. Without this, a reader
	// who signs in on a fresh browser sees nothing — which is precisely the
	// case keeping a copy in an account exists to solve.
	$effect(() => {
		if (account.signedIn) history.refreshRemote();
	});

	const notInAccount = $derived(history.notInAccount);

	/** Everything one vehicle's exports cover end to end, holes included. */
	function span(group: VehicleGroup): string {
		const start = Math.min(...group.entries.map((entry) => entry.startTime));
		const end = Math.max(...group.entries.map((entry) => entry.endTime));
		return `${dateOnly(start)} – ${dateOnly(end)}`;
	}

	function label(group: VehicleGroup): string {
		if (group.isDemo) return m.library.demonstration;
		const vin = settings.revealVin ? group.vin : maskVin(group.vin);
		return group.vmodel ? `${group.vmodel} · ${vin}` : vin;
	}

	async function backup(ids: string[]) {
		try {
			await history.backup(ids);
		} catch (error) {
			toast(m.library.backupFailed, {
				description: error instanceof Error ? error.message : m.library.somethingWrong,
				closeButton: true
			});
		}
	}

	async function remove(ids: string[]) {
		await history.remove(ids);
	}

	async function clearEverything() {
		confirmingClear = false;
		await history.removeAll();
	}

	/** Copies up to the account, and says plainly what would not go. */
	async function keepInAccount(ids: string[]) {
		let result;
		try {
			result = await history.sync(ids);
		} catch (error) {
			toast(m.library.nothingCopied, {
				description: error instanceof Error ? error.message : m.library.somethingWrong,
				closeButton: true
			});
			return;
		}
		if (result.failed.length > 0) {
			toast(m.library.notCopied(result.failed.length), {
				description: result.failed[0].reason,
				closeButton: true
			});
		} else {
			toast(m.library.keptInAccount(ids.length), {
				description: m.library.keptInAccountDetail
			});
		}
	}

	/**
	 * Publishes a whole export. It costs no storage: the link points at the
	 * objects the account already holds, and the record it serves has the
	 * vehicle identification number taken out of it.
	 */
	async function shareExport(entry: LibraryEntry) {
		try {
			const created = await api<{ url: string }>('/api/v1/shares', {
				method: 'POST',
				body: {
					kind: 'export',
					vmodel: entry.vmodel,
					exportId: entry.id,
					startTime: entry.startTime,
					endTime: entry.endTime,
					timeZone: settings.timeZone,
					meta: { days: entry.days, distanceKm: entry.distanceKm, trips: entry.trips }
				}
			});
			await navigator.clipboard.writeText(created.url).catch(() => {});
			toast(m.library.linkCopied, {
				description: m.library.linkCopiedDetail,
				duration: 8000
			});
		} catch (error) {
			toast(m.library.linkFailed, {
				description: error instanceof Error ? error.message : undefined,
				closeButton: true
			});
		}
	}

	async function removeFromAccount(ids: string[]) {
		try {
			await history.forget(ids);
		} catch (error) {
			toast(m.library.removeFailed, {
				description: error instanceof Error ? error.message : m.library.somethingWrong,
				closeButton: true
			});
			return;
		}
		toast(m.library.removed, {
			description: m.library.removedDetail
		});
	}

	/**
	 * Opens an export that is only in the account: it has to come down first,
	 * because everything that reads one reads it from this browser's store.
	 */
	async function fetchAndOpen(entry: LibraryEntry) {
		if (!(await bringHere([entry.id]))) return;
		await data.open([entry.id]);
	}

	/** Fetches down whatever part of a selection is not here yet. */
	async function bringHere(ids: string[]): Promise<boolean> {
		const missing = ids.filter((id) => !history.openable([id]));
		if (missing.length === 0) return true;

		return pull(missing);
	}

	/** Fetches exports down, and says plainly what would not come. */
	async function pull(ids: string[]): Promise<boolean> {
		let result;
		try {
			result = await history.pull(ids);
		} catch (error) {
			toast(m.library.fetchUnfinished, {
				description: error instanceof Error ? error.message : m.library.somethingWrong,
				closeButton: true
			});
			return false;
		}
		if (result.failed.length > 0) {
			toast(m.library.fetchFailed(ids.length), {
				description: result.failed[0].reason,
				closeButton: true
			});
			return false;
		}
		return true;
	}

	/**
	 * Merging happens against this browser's own store, so anything living only
	 * in the account comes down first rather than being quietly left out of the
	 * timeline.
	 */
	async function openTogether(ids: string[]) {
		if (!(await bringHere(ids))) return;
		await data.open(ids);
	}
</script>

{#if history.count > 0}
	<section class="mt-4 space-y-4">
		<div class="flex flex-wrap items-end justify-between gap-2">
			<div>
				<h2 class="text-base font-medium">{m.library.title}</h2>
				<p class="text-sm text-muted-foreground">
					{m.library.intro(account.signedIn)}
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if account.signedIn && notInAccount.length > 0}
					<Button
						variant="ghost"
						size="sm"
						disabled={history.busy}
						onclick={() => keepInAccount(notInAccount.map((entry) => entry.id))}
					>
						<CloudUploadIcon class="size-4" />
						{m.library.keepAll(notInAccount.length)}
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					disabled={history.busy || history.entries.length === 0}
					onclick={() => backup(history.entries.map((entry) => entry.id))}
				>
					<DownloadIcon class="size-4" />
					{m.library.backUpAll}
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (confirmingClear = true)}>
					<TrashIcon class="size-4" />
					{m.library.removeAll}
				</Button>
			</div>
		</div>

		{#each history.groups as group (group.vin)}
			{@const ids = group.entries.map((entry) => entry.id)}
			{@const whole = history.estimate(ids)}
			<Card.Root class="bg-card/50">
				<Card.Header>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="space-y-1">
							<Card.Title class="flex items-center gap-2 text-base">
								<CarIcon class="size-4 text-primary" />
								<span class="font-mono text-sm font-normal">{label(group)}</span>
								{#if group.isDemo}
									<Badge variant="secondary">{m.library.demo}</Badge>
								{/if}
							</Card.Title>
							{#if group.entries.length > 1}
								<p class="text-xs text-muted-foreground">
									{m.library.groupSpan(span(group), group.entries.length, bytes(whole.bytes))}
									{#if whole.bytes > VERY_HEAVY}
										{m.library.heavy}
									{/if}
								</p>
							{/if}
						</div>

						{#if group.entries.length > 1}
							<Button
								variant="outline"
								size="sm"
								disabled={data.status === 'loading' || history.busy}
								onclick={() => openTogether(ids)}
							>
								<LayersIcon class="size-4" />
								{m.library.openTogether}
							</Button>
						{/if}
					</div>
				</Card.Header>

				<Card.Content class="space-y-1">
					{#each group.entries as entry (entry.id)}
						<div
							class="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
						>
							<div class="min-w-40 flex-1">
								<p class="flex items-center gap-2 text-sm font-medium">
									{dateOnly(entry.startTime)} – {dateOnly(entry.endTime)}
									{#if account.signedIn}
										{#if entry.remote && entry.local}
											<CloudIcon class="size-3.5 text-primary" aria-label={m.library.both} />
										{:else if entry.remote}
											<Badge variant="secondary" class="gap-1">
												<CloudIcon class="size-3" />
												{m.library.inAccount}
											</Badge>
										{:else}
											<CloudOffIcon
												class="size-3.5 text-muted-foreground"
												aria-label={m.library.onlyHere}
											/>
										{/if}
									{/if}
								</p>
								<p class="text-xs text-muted-foreground tabular-nums">
									{m.library.entry(
										entry.days,
										distance(entry.distanceKm),
										entry.trips,
										bytes(entry.storedBytes)
									)}
								</p>
							</div>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
									<EllipsisIcon class="size-4" />
									<span class="sr-only">{m.library.more}</span>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#if entry.local}
										<DropdownMenu.Item onclick={() => data.open([entry.id])}>
											<LayersIcon class="size-4" />
											{m.library.openAlone}
										</DropdownMenu.Item>
									{:else}
										<DropdownMenu.Item disabled={history.busy} onclick={() => fetchAndOpen(entry)}>
											<CloudDownloadIcon class="size-4" />
											{m.library.fetchOpen}
										</DropdownMenu.Item>
									{/if}
									{#if entry.local}
										<DropdownMenu.Item onclick={() => backup([entry.id])}>
											<DownloadIcon class="size-4" />
											{m.library.backUp}
										</DropdownMenu.Item>
									{/if}
									{#if account.signedIn && entry.local && !entry.remote}
										<DropdownMenu.Item onclick={() => keepInAccount([entry.id])}>
											<CloudUploadIcon class="size-4" />
											{m.library.keepInAccount}
										</DropdownMenu.Item>
									{/if}
									{#if account.signedIn && entry.remote && !entry.local}
										<DropdownMenu.Item onclick={() => pull([entry.id])}>
											<CloudDownloadIcon class="size-4" />
											{m.library.fetchHere}
										</DropdownMenu.Item>
									{/if}
									{#if account.signedIn && entry.remote && !entry.isDemo}
										<DropdownMenu.Item onclick={() => shareExport(entry)}>
											<ShareIcon class="size-4" />
											{m.library.shareExport}
										</DropdownMenu.Item>
									{/if}
									{#if account.signedIn && entry.remote}
										<DropdownMenu.Item onclick={() => removeFromAccount([entry.id])}>
											<CloudOffIcon class="size-4" />
											{m.library.removeAccount}
										</DropdownMenu.Item>
									{/if}
									{#if entry.local}
										<DropdownMenu.Item onclick={() => remove([entry.id])}>
											<TrashIcon class="size-4" />
											{m.library.removeHere}
										</DropdownMenu.Item>
									{/if}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{/each}

		<p class="text-xs text-muted-foreground">
			{#if history.entries.length > 0}
				{m.library.usage(history.entries.length, bytes(history.totalBytes))}
				{#if history.usage && history.usage.quota > 0}
					{m.library.quota(bytes(history.usage.quota))}
				{:else}
					{m.library.onDevice}
				{/if}
				{m.library.evictionWarning(account.signedIn)}
			{:else}
				<!-- Nothing here, everything in the account: the sentence about this
				     browser's storage would be about nothing at all. -->
				{m.library.nothingHere}
			{/if}
		</p>
	</section>
{/if}

<Dialog.Root bind:open={confirmingClear}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.library.confirmTitle}</Dialog.Title>
			<Dialog.Description>
				{m.library.confirmDetail(history.entries.length, bytes(history.totalBytes))}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (confirmingClear = false)}
				>{m.library.keepThem}</Button
			>
			<Button variant="destructive" onclick={clearEverything}>{m.library.removeAll}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
