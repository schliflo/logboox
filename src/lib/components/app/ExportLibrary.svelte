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
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { data } from '$lib/state/dataset.svelte';
	import { account } from '$lib/state/account.svelte';
	import { history, type LibraryEntry, type VehicleGroup } from '$lib/state/history.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { bytes, dateOnly, maskVin, num } from '$lib/utils/format';
	import CarIcon from '@lucide/svelte/icons/car';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import CloudDownloadIcon from '@lucide/svelte/icons/cloud-download';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	/** Above this, a merged timeline is worth warning about before it is built. */
	const HEAVY = 500 * 1024 * 1024;
	const VERY_HEAVY = 1024 * 1024 * 1024;

	let selected = $state<string[]>([]);
	let selectedVin = $state<string | null>(null);
	let confirmingClear = $state(false);

	onMount(() => {
		history.refresh();
	});

	const estimate = $derived(history.estimate(selected));
	const notInAccount = $derived(history.notInAccount);

	function toggle(entry: LibraryEntry) {
		// Exports only merge within one vehicle, so picking another vehicle
		// starts a fresh selection rather than offering an impossible combination.
		if (selectedVin !== entry.vin) {
			selectedVin = entry.vin;
			selected = [entry.id];
			return;
		}
		selected = selected.includes(entry.id)
			? selected.filter((id) => id !== entry.id)
			: [...selected, entry.id];
		if (selected.length === 0) selectedVin = null;
	}

	/** Everything one vehicle's exports cover end to end, holes included. */
	function span(group: VehicleGroup): string {
		const start = Math.min(...group.entries.map((entry) => entry.startTime));
		const end = Math.max(...group.entries.map((entry) => entry.endTime));
		return `${dateOnly(start)} – ${dateOnly(end)}`;
	}

	function label(group: VehicleGroup): string {
		if (group.isDemo) return 'Demonstration data';
		const vin = settings.revealVin ? group.vin : maskVin(group.vin);
		return group.vmodel ? `${group.vmodel} · ${vin}` : vin;
	}

	async function backup(ids: string[]) {
		try {
			await history.backup(ids);
		} catch (error) {
			toast('The backup could not be written', {
				description: error instanceof Error ? error.message : 'Something went wrong.',
				closeButton: true
			});
		}
	}

	async function remove(ids: string[]) {
		await history.remove(ids);
		selected = selected.filter((id) => !ids.includes(id));
		if (selected.length === 0) selectedVin = null;
	}

	async function clearEverything() {
		confirmingClear = false;
		await history.removeAll();
		selected = [];
		selectedVin = null;
	}

	/** Copies up to the account, and says plainly what would not go. */
	async function keepInAccount(ids: string[]) {
		const result = await history.sync(ids);
		if (result.failed.length > 0) {
			toast(
				result.failed.length === 1
					? 'One export was not copied'
					: `${result.failed.length} exports were not copied`,
				{ description: result.failed[0].reason, closeButton: true }
			);
		} else {
			toast(
				ids.length === 1 ? 'Kept in your account' : `${ids.length} exports kept in your account`,
				{
					description: 'They will still be here if this browser forgets everything.'
				}
			);
		}
	}

	async function removeFromAccount(ids: string[]) {
		await history.forget(ids);
		toast('Removed from your account', {
			description: 'The copy in this browser is untouched.'
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

		const result = await history.pull(missing);
		if (result.failed.length > 0) {
			toast(
				missing.length === 1
					? 'That export could not be fetched'
					: 'Some exports could not be fetched',
				{ description: result.failed[0].reason, closeButton: true }
			);
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
	<section class="mt-10 space-y-4">
		<div class="flex flex-wrap items-end justify-between gap-2">
			<div>
				<h2 class="text-lg font-medium">Your exports</h2>
				<p class="text-sm text-muted-foreground">
					{#if account.signedIn}
						Kept in this browser, in your account, or both. Open one, or every export from the same
						car as a single timeline.
					{:else}
						Stored on this device only. Open one, or every export from the same car as a single
						timeline.
					{/if}
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
						Keep {notInAccount.length === 1 ? 'it' : `all ${notInAccount.length}`} in my account
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					disabled={history.busy || history.entries.length === 0}
					onclick={() => backup(history.entries.map((entry) => entry.id))}
				>
					<DownloadIcon class="size-4" />
					Back up everything
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (confirmingClear = true)}>
					<TrashIcon class="size-4" />
					Remove everything
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
									<Badge variant="secondary">Demo</Badge>
								{/if}
							</Card.Title>
							{#if group.entries.length > 1}
								<p class="text-xs text-muted-foreground">
									{span(group)} across {group.entries.length} exports, up to {bytes(whole.bytes)} of memory
									at once.
									{#if whole.bytes > VERY_HEAVY}
										That is a great deal for one tab to hold.
									{/if}
								</p>
							{/if}
						</div>

						{#if group.entries.length > 1}
							<Button
								size="sm"
								disabled={data.status === 'loading' || history.busy}
								onclick={() => openTogether(ids)}
							>
								<LayersIcon class="size-4" />
								Open all {group.entries.length}
							</Button>
						{/if}
					</div>
				</Card.Header>

				<Card.Content class="space-y-1">
					{#each group.entries as entry (entry.id)}
						{@const checked = selected.includes(entry.id)}
						<div
							class="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
							class:bg-muted={checked}
						>
							<input
								type="checkbox"
								class="size-4 shrink-0 accent-primary"
								{checked}
								onchange={() => toggle(entry)}
								aria-label="Select the export from {dateOnly(entry.startTime)}"
							/>

							<div class="min-w-40 flex-1">
								<p class="text-sm font-medium">
									{dateOnly(entry.startTime)} – {dateOnly(entry.endTime)}
								</p>
								<p class="text-xs text-muted-foreground tabular-nums">
									{entry.days} days · {num(entry.distanceKm)} km · {entry.trips} trips · {bytes(
										entry.storedBytes
									)}
								</p>
							</div>

							<Button variant="secondary" size="sm" onclick={() => data.open([entry.id])}>
								Open
							</Button>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
									<EllipsisIcon class="size-4" />
									<span class="sr-only">More for this export</span>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => backup([entry.id])}>
										<DownloadIcon class="size-4" />
										Back up
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => remove([entry.id])}>
										<TrashIcon class="size-4" />
										Remove
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					{/each}

					{#if selectedVin === group.vin && selected.length > 1}
						<div class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
							<Button
								size="sm"
								disabled={data.status === 'loading' || history.busy}
								onclick={() => openTogether(selected)}
							>
								<LayersIcon class="size-4" />
								Open {selected.length} together
							</Button>
							<p class="text-xs text-muted-foreground">
								One timeline from {selected.length} exports, using up to {bytes(estimate.bytes)} of memory.
								{#if estimate.bytes > VERY_HEAVY}
									That is a great deal to hold at once, and a browser tab may not manage it.
								{:else if estimate.bytes > HEAVY}
									Where they overlap it will be less, but expect it to take a moment.
								{/if}
							</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}

		<p class="text-xs text-muted-foreground">
			{history.entries.length}
			{history.entries.length === 1 ? 'export' : 'exports'} taking {bytes(history.totalBytes)}
			{#if history.usage && history.usage.quota > 0}
				of roughly {bytes(history.usage.quota)} this site may use.
			{:else}
				on this device.
			{/if}
			A browser can clear its own storage — Safari does so after a week away — so keep a backup of anything
			you want to hold on to.
		</p>
	</section>
{/if}

<Dialog.Root bind:open={confirmingClear}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Remove every kept export?</Dialog.Title>
			<Dialog.Description>
				All {history.entries.length} of them, {bytes(history.totalBytes)}, deleted from this
				browser. The original files XPeng sent you are untouched, but anything not backed up would
				have to be dropped in again.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (confirmingClear = false)}>Keep them</Button>
			<Button variant="destructive" onclick={clearEverything}>Remove everything</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
