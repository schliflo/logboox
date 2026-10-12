/** Words a finding from the analysis in the current language. */

import type { Fact } from '../data/analytics/facts';
import type { FactFormat, FactText } from './en/facts';
import { duration, num, fullDateTime, hourLabel, prettyDay } from '../utils/format';
import { columnLabel } from './columns';
import { m } from './index.svelte';

const FORMAT: FactFormat = {
	num,
	duration: (seconds) => duration(seconds),
	when: fullDateTime,
	hour: hourLabel,
	day: prettyDay,
	column: (key) => columnLabel(key),
	list: (items) => items.join(', ')
};

/** `format` swaps single formatters, e.g. to read times in another zone. */
export function factText(fact: Fact, format?: Partial<FactFormat>): FactText {
	const word = m.facts[fact.id] as (p: Fact['params'], f: FactFormat) => FactText;
	return word(fact.params, format ? { ...FORMAT, ...format } : FORMAT);
}
