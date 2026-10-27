/**
 * Viewing preferences.
 *
 * Held in memory only: these reset with the tab, unlike the exports themselves,
 * which are kept. The timezone defaults to the browser's, which is what makes
 * "your day" mean the driver's day rather than the warehouse partition the
 * export was cut on.
 */

import { intlLocale } from '../i18n/index.svelte';
import type { DistanceUnit } from '../export/columns';

/** Where the currency isn't the euro. Anywhere else defaults to EUR. */
const REGION_CURRENCY: Record<string, string> = {
	GB: 'GBP',
	CH: 'CHF',
	LI: 'CHF',
	NO: 'NOK',
	SE: 'SEK',
	DK: 'DKK',
	IS: 'ISK',
	PL: 'PLN',
	CZ: 'CZK',
	HU: 'HUF',
	RO: 'RON',
	TR: 'TRY',
	IL: 'ILS',
	AE: 'AED',
	SA: 'SAR',
	QA: 'QAR',
	US: 'USD',
	CA: 'CAD',
	MX: 'MXN',
	AU: 'AUD',
	NZ: 'NZD',
	SG: 'SGD',
	HK: 'HKD',
	CN: 'CNY',
	JP: 'JPY',
	KR: 'KRW',
	TH: 'THB',
	MY: 'MYR',
	ID: 'IDR',
	ZA: 'ZAR'
};

export const CURRENCIES = [...new Set(['EUR', ...Object.values(REGION_CURRENCY)])].sort();

/** The region of the browser's preferred language, if it names one. */
export function browserRegion(languages: readonly string[]): string | undefined {
	for (const tag of languages) {
		try {
			const region = new Intl.Locale(tag).region;
			if (region) return region;
		} catch {
			// Not a valid tag: try the next one.
		}
	}
}

const region =
	typeof navigator !== 'undefined'
		? browserRegion(navigator.languages?.length ? navigator.languages : [navigator.language])
		: undefined;

class Settings {
	/** Timezone used for every date, hour and day boundary in the app. */
	timeZone = $state(
		typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
	);

	/** Electricity price for the cost estimates, in the chosen currency. */
	pricePerKwh = $state(0.32);
	currency = $state((region && REGION_CURRENCY[region]) || 'EUR');

	/** Miles also means mph and mi/kWh. The data itself stays metric. */
	distanceUnit = $state<DistanceUnit>(region === 'GB' || region === 'US' ? 'mi' : 'km');

	/** The VIN is a direct identifier, so it stays hidden until asked for. */
	revealVin = $state(false);

	/** Whether to list signals the car never reported. */
	showEmptySignals = $state(false);

	formatCurrency(amount: number): string {
		if (!Number.isFinite(amount)) return '—';
		return amount.toLocaleString(intlLocale(), {
			style: 'currency',
			currency: this.currency,
			maximumFractionDigits: amount >= 100 ? 0 : 2
		});
	}
}

export const settings = new Settings();
