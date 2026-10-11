<!--
  One badge, and the snippets that put it in a forum post.

  The picture is public at its address, which is the point; the dialog says so
  rather than leaving it to be found out.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import {
		BADGE_HEIGHT,
		BADGE_WIDTH,
		badgeAlt,
		badgeEmbeds,
		badgePath,
		type OwnBadge
	} from '#lib/leaderboard/medals.js';
	import { periodLabel } from '#lib/i18n/dates.js';
	import { boardText } from '#lib/i18n/boards.js';
	import CopyIcon from '@lucide/svelte/icons/copy';

	interface Props {
		open: boolean;
		badge: OwnBadge | null;
		username: string;
	}

	let { open = $bindable(), badge, username }: Props = $props();

	const embeds = $derived(
		badge && typeof location !== 'undefined' ? badgeEmbeds(location.origin, badge, username) : null
	);

	const snippets = $derived(
		embeds
			? [
					{ id: 'discourse', label: 'Discourse', text: embeds.discourse },
					{ id: 'markdown', label: 'Markdown', text: embeds.markdown },
					{ id: 'html', label: 'HTML', text: embeds.html },
					{ id: 'bbcode', label: 'BBCode', text: embeds.bbcode },
					{ id: 'url', label: m.claims.imageLink, text: embeds.url }
				]
			: []
	);

	async function copy(label: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast(m.claims.snippetCopied(label));
		} catch {
			toast(m.claims.copyFailed, { description: m.claims.copyByHand });
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-2xl">
		{#if badge}
			<Dialog.Header>
				<Dialog.Title>
					{boardText(badge.board).label} · {periodLabel(badge.period)}
				</Dialog.Title>
				<Dialog.Description>
					{m.claims.badgePublic}
				</Dialog.Description>
			</Dialog.Header>

			<img
				src={badgePath(badge.period, badge.board, username, 2)}
				alt={badgeAlt(badge, username)}
				width={BADGE_WIDTH}
				height={BADGE_HEIGHT}
				class="mx-auto h-auto w-full max-w-[560px] rounded-lg border"
			/>

			<div class="space-y-3">
				{#each snippets as snippet (snippet.id)}
					<div class="space-y-1">
						<Label for="badge-{snippet.id}" class="text-xs">{snippet.label}</Label>
						<div class="flex gap-2">
							<Input
								id="badge-{snippet.id}"
								readonly
								value={snippet.text}
								class="font-mono text-xs"
							/>
							<Button
								variant="outline"
								size="icon"
								onclick={() => copy(snippet.label, snippet.text)}
							>
								<CopyIcon class="size-4" />
								<span class="sr-only">{m.claims.copySnippet(snippet.label)}</span>
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<Dialog.Footer>
				<Button onclick={() => (open = false)}>{m.common.done}</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
