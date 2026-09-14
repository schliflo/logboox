<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import BigStat from '$lib/components/charts/BigStat.svelte';
	import SessionDetail from '$lib/components/app/SessionDetail.svelte';
	import ShareButton from '$lib/components/app/ShareButton.svelte';
	import BoardBanner from '$lib/components/app/BoardBanner.svelte';
	import Histogram from '$lib/components/charts/Histogram.svelte';
	import { data } from '$lib/state/dataset.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { dateTime, duration, num, fullDateTime, hourLabel } from '$lib/utils/format';
	import { localHour } from '$lib/data/analytics/charging';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);
	const charging = $derived(stats.charging);

	const selected = $derived.by(() => {
		const raw = page.url.searchParams.get('session');
		if (raw === null) return null;
		const index = Number(raw);
		return Number.isInteger(index) && index >= 0 && index < charging.sessions.length
			? charging.sessions[index]
			: null;
	});

	/** When sessions start, in the viewer's own hours. */
	const startHours = $derived.by(() => {
		const counts = new Array(24).fill(0);
		for (const session of charging.sessions) {
			counts[localHour(session.startTime, settings.timeZone)]++;
		}
		return counts;
	});
</script>

{#if selected}
	<div class="mx-auto max-w-5xl space-y-6">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" onclick={() => goto('/dash/charging')}>
				<ArrowLeftIcon class="size-4" />
				All sessions
			</Button>
			<span class="text-sm text-muted-foreground">{fullDateTime(selected.startTime)}</span>
			<div class="ml-auto">
				<ShareButton
					kind="charging"
					startTime={selected.startTime}
					endTime={selected.endTime}
					meta={{
						duration: selected.duration,
						kwhDelivered: selected.kwhDelivered,
						maxKw: selected.maxKw,
						isDc: selected.isDc,
						socStart: selected.socStart,
						socEnd: selected.socEnd
					}}
				/>
			</div>
		</div>

		<BoardBanner startTime={selected.startTime} />

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Energy delivered"
						value={num(selected.kwhDelivered, 1)}
						unit="kWh"
						size="sm"
						accent="--viz-3"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Duration"
						value={duration(selected.duration, 'short')}
						size="sm"
						accent="--viz-1"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Peak power"
						value={num(selected.maxKw, 1)}
						unit="kW"
						size="sm"
						accent="--viz-2"
						detail={selected.isDc ? 'Rapid DC charging' : 'Through the onboard AC charger'}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Charge added"
						value="{num(selected.socStart)} → {num(selected.socEnd)}"
						unit="%"
						size="sm"
						accent="--viz-4"
						detail="Estimated cost {settings.formatCurrency(
							selected.kwhDelivered * settings.pricePerKwh
						)}"
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>How the charge went</Card.Title>
				<Card.Description>
					Power tapers as the battery fills; the flat top is the charger's limit.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<SessionDetail
					source={dataset}
					from={selected.start}
					to={selected.end}
					syncKey={`charge-${selected.index}`}
				/>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="mx-auto max-w-6xl space-y-6">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Energy charged"
						value={num(charging.totalKwh)}
						unit="kWh"
						size="sm"
						accent="--viz-3"
						detail="About {settings.formatCurrency(
							charging.totalKwh * settings.pricePerKwh
						)} at your rate"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Sessions"
						value={num(charging.sessions.length)}
						size="sm"
						accent="--viz-1"
						detail="{charging.acSessions} on AC, {charging.dcSessions} rapid"
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker={charging.scheduledHour !== null ? 'Scheduled for' : 'Usually plugged in at'}
						value={hourLabel(charging.scheduledHour ?? charging.plugInHour ?? 0)}
						size="sm"
						accent="--viz-7"
						detail={charging.scheduledHour !== null
							? `${charging.scheduledCount} sessions began in this hour — that is a timer`
							: `${charging.plugInCount} of ${charging.sessions.length} sessions started then`}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content>
					<BigStat
						kicker="Charge limit"
						value={charging.chargeLimit !== null ? `${charging.chargeLimit}` : 'None set'}
						unit={charging.chargeLimit !== null ? '%' : undefined}
						size="sm"
						accent="--viz-4"
						detail={charging.chargeLimit !== null
							? 'Charging repeatedly stops here of its own accord'
							: 'Charges run to full as often as they stop short'}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>When you charge</Card.Title>
				<Card.Description>Sessions by the hour they began, in your own time zone.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Histogram
					edges={Array.from({ length: 24 }, (_, i) => i)}
					counts={startHours}
					accent="--viz-charge"
					height={120}
					unit=""
					formatBin={(from) => `${hourLabel(from)}–${hourLabel((from + 1) % 24)}`}
					label="Hour of day"
				/>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Every session</Card.Title>
				<Card.Description>
					Found from the charging-power signal, joined across the naps the car takes mid-charge.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Started</Table.Head>
								<Table.Head class="text-right">Duration</Table.Head>
								<Table.Head class="text-right">Energy</Table.Head>
								<Table.Head class="text-right">Peak</Table.Head>
								<Table.Head class="text-right">Charge</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each charging.sessions as session (session.index)}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50"
									onclick={() => goto(`/dash/charging?session=${session.index}`)}
								>
									<Table.Cell class="font-medium">{dateTime(session.startTime)}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{duration(session.duration, 'short')}
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">
										{num(session.kwhDelivered, 1)} kWh
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{num(session.maxKw, 1)} kW</Table.Cell
									>
									<Table.Cell class="text-right tabular-nums">
										{num(session.socStart)}% → {num(session.socEnd)}%
									</Table.Cell>
									<Table.Cell class="text-right">
										<Badge variant={session.isDc ? 'default' : 'secondary'}>
											{session.isDc ? 'Rapid' : 'AC'}
										</Badge>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
