<!--
  What the export cannot know.

  An XPeng export has no location data of any kind, so where a journey went is
  the one thing only the driver can supply. This is where they supply it — and
  where a month of driving becomes a Fahrtenbuch rather than a list of times
  and distances.

  The suggestions are the point. Nothing here knows where anywhere is; it knows
  that the last trip ended at this odometer reading, that a drive of this
  length leaves at this hour on weekdays, and that the way back is the most
  repeated journey anyone makes. Typing a place twice should be the last time
  it has to be typed.

  Notes are kept in this browser whether or not anyone is signed in. An account
  only carries them to the next device.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { logbook } from '$lib/state/logbook.svelte';
	import { data } from '$lib/state/dataset.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { suggestDestinations, suggestOrigin, suggestPurpose } from '$lib/logbook/suggest';
	import { PURPOSES, type Purpose } from '$lib/logbook/types';
	import type { Trip } from '$lib/data/analytics/trips';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import WandIcon from '@lucide/svelte/icons/wand-sparkles';

	interface Props {
		trip: Trip;
	}

	let { trip }: Props = $props();

	const note = $derived(logbook.for(trip));
	const trips = $derived(data.derived?.trips ?? []);
	const bound = $derived(logbook.bound.byTrip);

	const origins = $derived(suggestOrigin(trip, trips, bound, settings.timeZone));
	const destinations = $derived(
		suggestDestinations(trip, trips, bound, settings.timeZone, note.origin)
	);
	const purpose = $derived(note.purpose || suggestPurpose(trip, trips, bound, settings.timeZone));

	function set(field: 'origin' | 'destination' | 'comment', value: string) {
		logbook.save({ ...logbook.for(trip), [field]: value });
	}

	function setPurpose(value: Purpose) {
		const current = logbook.for(trip);
		logbook.save({ ...current, purpose: current.purpose === value ? '' : value });
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-wrap items-start justify-between gap-2">
			<div>
				<Card.Title class="flex items-center gap-2">
					<MapPinIcon class="size-4 text-primary" />
					Where did this one go?
				</Card.Title>
				<Card.Description>
					The export has no location data at all. Fill this in and it becomes a logbook.
				</Card.Description>
			</div>
			{#if logbook.syncing}
				<Badge variant="secondary" class="gap-1">
					<CloudIcon class="size-3" />
					Saving
				</Badge>
			{/if}
		</div>
	</Card.Header>

	<Card.Content class="space-y-4">
		<datalist id="known-places">
			{#each logbook.places as place (place)}
				<option value={place}></option>
			{/each}
		</datalist>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<Label for="trip-origin">From</Label>
				<Input
					id="trip-origin"
					list="known-places"
					placeholder="Where it started"
					value={note.origin}
					onchange={(event) => set('origin', event.currentTarget.value)}
				/>
				{#if !note.origin && origins.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each origins as suggestion (suggestion.value)}
							<button
								type="button"
								class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
								title={suggestion.reason}
								onclick={() => set('origin', suggestion.value)}
							>
								<WandIcon class="size-3 text-primary" />
								{suggestion.value}
							</button>
						{/each}
					</div>
					<p class="text-xs text-muted-foreground">{origins[0].reason}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="trip-destination">To</Label>
				<Input
					id="trip-destination"
					list="known-places"
					placeholder="Where it ended"
					value={note.destination}
					onchange={(event) => set('destination', event.currentTarget.value)}
				/>
				{#if !note.destination && destinations.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each destinations as suggestion (suggestion.value)}
							<button
								type="button"
								class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
								title={suggestion.reason}
								onclick={() => set('destination', suggestion.value)}
							>
								<WandIcon class="size-3 text-primary" />
								{suggestion.value}
							</button>
						{/each}
					</div>
					<p class="text-xs text-muted-foreground">{destinations[0].reason}</p>
				{/if}
			</div>
		</div>

		<div class="space-y-2">
			<Label>Purpose</Label>
			<div class="flex flex-wrap gap-2">
				{#each PURPOSES as option (option.value)}
					<Button
						variant={note.purpose === option.value ? 'default' : 'outline'}
						size="sm"
						onclick={() => setPurpose(option.value)}
					>
						{option.label}
					</Button>
				{/each}
				{#if !note.purpose && purpose}
					<span class="self-center text-xs text-muted-foreground">
						Trips like this one are usually {purpose}.
					</span>
				{/if}
			</div>
		</div>

		<div class="space-y-2">
			<Label for="trip-comment">Notes</Label>
			<textarea
				id="trip-comment"
				rows="2"
				class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				placeholder="Anything worth remembering about this drive"
				value={note.comment}
				onchange={(event) => set('comment', event.currentTarget.value)}></textarea>
		</div>
	</Card.Content>
</Card.Root>
