<script lang="ts">
	import PageFindings from '#lib/components/app/PageFindings.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import BigStat from '#lib/components/charts/BigStat.svelte';
	import SessionDetail from '#lib/components/app/SessionDetail.svelte';
	import ShareButton from '#lib/components/app/ShareButton.svelte';
	import BoardBanner from '#lib/components/app/BoardBanner.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import ExportMenu from '#lib/components/app/ExportMenu.svelte';
	import { data } from '#lib/state/dataset.svelte.js';
	import { sessionLink, startFromParam } from '#lib/data/range.js';
	import { settings } from '#lib/state/settings.svelte.js';
	import { CHARGING_COLUMNS } from '#lib/export/columns.js';
	import {
		dateTime,
		duration,
		maskVin,
		measure,
		num,
		fullDateTime,
		hourLabel
	} from '#lib/utils/format.js';
	import { localHour } from '#lib/data/analytics/charging.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const stats = $derived(data.derived!);
	const dataset = $derived(data.dataset!);
	const charging = $derived(stats.charging);

	// A session is named by when it started, which means the same in every range.
	const wanted = $derived(startFromParam(page.url.searchParams.get('session')));
	const selected = $derived(
		wanted === null
			? null
			: (charging.sessions.find((session) => session.startTime === wanted) ?? null)
	);

	// A link to a session outside the range on screen widens the view to reach
	// it. Only a link does: narrowing the range under an open session goes back
	// to the list, rather than undoing the choice that was just made.
	let followed: number | null = null;
	$effect(() => {
		if (wanted === null || selected) {
			followed = wanted;
		} else if (followed === wanted) {
			void goto('/dash/charging', { replaceState: true });
		} else {
			followed = wanted;
			data.reveal('charging', wanted);
		}
	});

	/**
	 * Every session, oldest first, with the price the cost estimate uses.
	 *
	 * The whole list rather than the page on screen: somebody downloading this
	 * is reconciling it against invoices, and half of it is no use for that.
	 */
	const exportRows = $derived(
		[...charging.sessions]
			.sort((a, b) => a.startTime - b.startTime)
			.map((session) => ({ session, pricePerKwh: settings.pricePerKwh }))
	);

	const exportVehicle = $derived(
		[dataset.vmodel, settings.revealVin ? dataset.vin : maskVin(dataset.vin)]
			.filter(Boolean)
			.join(' · ')
	);

	const exportTotals = $derived([
		{ label: 'Sessions', value: `${num(charging.sessions.length)}` },
		{ label: 'Energy delivered', value: measure(charging.totalKwh, 'kWh', 1) },
		...(settings.pricePerKwh > 0
			? [
					{
						label: 'Estimated cost',
						value: `${num(charging.totalKwh * settings.pricePerKwh, 2)} at ${num(settings.pricePerKwh, 2)} per kWh`
					}
				]
			: [])
	]);

	const lowest = $derived(
		charging.sessions.reduce<(typeof charging.sessions)[number] | null>(
			(low, session) => (!low || session.socStart < low.socStart ? session : low),
			null
		)
	);

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
		<PageFindings />
		<section
			aria-label="At a glance"
			class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4"
		>
			{#each [{ kicker: 'Energy charged', value: num(charging.totalKwh), unit: 'kWh', accent: '--viz-4', detail: `${num(charging.sessions.length)} sessions` }, { kicker: 'Cost', value: settings.formatCurrency(charging.totalKwh * settings.pricePerKwh), unit: '', accent: '--viz-5', detail: `At ${settings.formatCurrency(settings.pricePerKwh)} per kWh` }, { kicker: 'Fast charging', value: num(charging.dcSessions), unit: charging.dcSessions === 1 ? 'session' : 'sessions', accent: '--viz-3', detail: `${num(charging.acSessions)} on AC` }, { kicker: 'Lowest charge', value: lowest ? num(lowest.socStart) : '—', unit: lowest ? '%' : '', accent: '--viz-8', detail: lowest ? `Before the session on ${dateTime(lowest.startTime)}` : 'No sessions in this range' }] as stat (stat.kicker)}
				<div class="bg-card p-5 sm:p-6">
					<BigStat
						kicker={stat.kicker}
						value={stat.value}
						unit={stat.unit || undefined}
						size="sm"
						accent={stat.accent}
						detail={stat.detail}
					/>
				</div>
			{/each}
		</section>

		<div class="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
			<Card.Root class="lg:order-2">
				<Card.Header>
					<Card.Title>When you plug in</Card.Title>
					<Card.Description
						>Sessions by the hour they began, in your own time zone.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<Histogram
						edges={Array.from({ length: 24 }, (_, i) => i)}
						counts={startHours}
						accent="--viz-charge"
						height={140}
						unit=""
						formatBin={(from) => `${hourLabel(from)}–${hourLabel((from + 1) % 24)}`}
						label="Hour of day"
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root class="min-w-0">
				<Card.Header>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<Card.Title>Every session</Card.Title>
							<Card.Description>
								Found from the charging-power signal, joined across the naps the car takes
								mid-charge.
							</Card.Description>
						</div>
						<ExportMenu
							kind="charging"
							variant="ghost"
							title="Charging sessions"
							subtitle={exportVehicle}
							columns={CHARGING_COLUMNS}
							rows={exportRows}
							totals={exportTotals}
							timeZone={settings.timeZone}
							from={exportRows[0]?.session.startTime ?? 0}
							to={exportRows[exportRows.length - 1]?.session.endTime ?? 0}
						/>
					</div>
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
										onclick={() => goto(sessionLink(session.startTime))}
									>
										<Table.Cell class="font-medium">{dateTime(session.startTime)}</Table.Cell>
										<Table.Cell class="text-right tabular-nums">
											{duration(session.duration, 'short')}
										</Table.Cell>
										<Table.Cell class="text-right tabular-nums">
											{num(session.kwhDelivered, 1)} kWh
										</Table.Cell>
										<Table.Cell class="text-right tabular-nums"
											>{num(session.maxKw, 1)} kW</Table.Cell
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
	</div>
{/if}
