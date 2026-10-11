/** Signal names and states in the current language, falling back to the registry. */

import { COLUMNS, type ColumnCategory, type ColumnSpec } from '../data/schema/columns';
import { m } from './index.svelte';

export function columnLabel(key: string): string {
	return m.columns.labels[key] ?? COLUMNS.get(key)?.label ?? key;
}

export function columnDescription(spec: ColumnSpec): string | undefined {
	if (!COLUMNS.has(spec.key)) return spec.description ? m.columns.unknown : undefined;
	return m.columns.descriptions[spec.key] ?? spec.description;
}

export function categoryLabel(category: ColumnCategory): string {
	return m.columns.categories[category];
}
