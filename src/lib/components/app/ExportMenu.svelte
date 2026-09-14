<!--
  "Download this list."

  One menu over three writers, so the choice between a CSV, a spreadsheet and a
  document is made here and nowhere else. Every format takes the whole list in
  date order rather than whatever the table is currently filtered or sorted by:
  a Fahrtenbuch has to be complete, and the "unlabelled only" switch on the
  trips page is an aid to labelling rather than a selection.

  All three are written in this tab out of data that never left it. The PDF is
  the one that needs the network — its writer and the typeface it embeds are
  fetched on first use rather than carried by every visitor — so it is the one
  that can fail, and it says so plainly when it does.
-->
<script lang="ts" generics="T">
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { buttonVariants } from '$lib/components/ui/button';
	import { downloadBlob } from '$lib/utils/download';
	import { toCsv } from '$lib/export/csv';
	import { exportFileName, type ExportKind } from '$lib/export/filenames';
	import type { Column } from '$lib/export/columns';
	import type { Sheet } from '$lib/export/xlsx';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import TableIcon from '@lucide/svelte/icons/table';
	import SheetIcon from '@lucide/svelte/icons/sheet';
	import FileTextIcon from '@lucide/svelte/icons/file-text';

	interface Props {
		kind: ExportKind;
		/** The tab the rows land on, and the heading of the document. */
		title: string;
		/** The car and the period, under the title of the document. */
		subtitle: string;
		columns: Array<Column<T>>;
		rows: T[];
		timeZone: string;
		/** The span the file covers, for its name. */
		from: number;
		to: number;
		/** Figures under the table in the document. */
		totals?: Array<{ label: string; value: string }>;
		/** Anything a reader should know before trusting it. */
		notes?: string[];
		/** A second tab in the workbook, when the list has a summary worth one. */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		extraSheet?: Sheet<any>;
		variant?: 'default' | 'outline' | 'secondary' | 'ghost';
		size?: 'sm' | 'default';
	}

	let {
		kind,
		title,
		subtitle,
		columns,
		rows,
		timeZone,
		from,
		to,
		totals,
		notes,
		extraSheet,
		variant = 'outline',
		size = 'sm'
	}: Props = $props();

	let busy = $state<'csv' | 'xlsx' | 'pdf' | null>(null);

	const name = (extension: 'csv' | 'xlsx' | 'pdf') =>
		exportFileName(kind, from, to, timeZone, extension);

	function save(extension: 'csv' | 'xlsx' | 'pdf', bytes: BlobPart, type: string) {
		downloadBlob(name(extension), new Blob([bytes], { type }));
	}

	function csv() {
		save('csv', toCsv(columns, rows, timeZone), 'text/csv;charset=utf-8');
	}

	async function xlsx() {
		const { toXlsx } = await import('$lib/export/xlsx');
		const sheets = [{ name: title, columns, rows, timeZone }, ...(extraSheet ? [extraSheet] : [])];
		save(
			'xlsx',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			toXlsx(sheets as Array<Sheet<any>>),
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
	}

	async function pdf() {
		const { toPdf } = await import('$lib/export/pdf');
		const bytes = await toPdf({ title, subtitle, columns, rows, timeZone, totals, notes });
		save('pdf', bytes, 'application/pdf');
	}

	async function run(format: 'csv' | 'xlsx' | 'pdf', write: () => void | Promise<void>) {
		if (busy) return;
		busy = format;
		try {
			await write();
		} catch (error) {
			// Offline, this is where a PDF ends up: the chunk and the typeface are
			// fetched on first use, and there is nothing to fall back to.
			toast('That file could not be written', {
				description:
					error instanceof Error && navigator.onLine
						? error.message
						: 'A PDF needs a connection the first time. The CSV and the spreadsheet do not.',
				closeButton: true
			});
		} finally {
			busy = null;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={buttonVariants({ variant, size })} disabled={rows.length === 0}>
		<DownloadIcon class="size-4" />
		Export
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-60">
		<DropdownMenu.Label class="font-normal text-muted-foreground">
			{rows.length}
			{rows.length === 1 ? 'row' : 'rows'}, oldest first
		</DropdownMenu.Label>
		<DropdownMenu.Separator />

		<DropdownMenu.Item disabled={busy !== null} onSelect={() => run('csv', csv)}>
			<TableIcon class="size-4" />
			<span class="flex-1">CSV</span>
			<span class="text-xs text-muted-foreground">for anything</span>
		</DropdownMenu.Item>

		<DropdownMenu.Item disabled={busy !== null} onSelect={() => run('xlsx', xlsx)}>
			<SheetIcon class="size-4" />
			<span class="flex-1">Excel</span>
			<span class="text-xs text-muted-foreground">real dates</span>
		</DropdownMenu.Item>

		<DropdownMenu.Item disabled={busy !== null} onSelect={() => run('pdf', pdf)}>
			<FileTextIcon class="size-4" />
			<span class="flex-1">PDF</span>
			<span class="text-xs text-muted-foreground">to hand over</span>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
