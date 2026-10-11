<!--
  Says when the app has been stored for offline use, and when a newer version
  is waiting.

  SvelteKit registers the service worker itself; this only listens to it. The
  reload that applies an update is never automatic: the export on screen is
  held in memory, and a page that restarted on its own would clear it mid-read.
-->
<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { onMount } from 'svelte';
	import { dev } from '$app/env';
	import { toast } from 'svelte-sonner';

	onMount(() => {
		if (dev || !('serviceWorker' in navigator)) return;
		const container = navigator.serviceWorker;

		let reloadRequested = false;
		let registration: ServiceWorkerRegistration | undefined;

		const offerUpdate = (waiting: ServiceWorker) => {
			toast(m.offline.update, {
				description: m.offline.updateDetail,
				duration: Number.POSITIVE_INFINITY,
				closeButton: true,
				action: {
					label: m.offline.reload,
					onClick: () => {
						reloadRequested = true;
						waiting.postMessage({ type: 'SKIP_WAITING' });
					}
				}
			});
		};

		const watchInstall = (worker: ServiceWorker) => {
			worker.addEventListener('statechange', () => {
				if (worker.state === 'installed' && container.controller) offerUpdate(worker);
			});
		};

		const onUpdateFound = () => {
			if (registration?.installing) watchInstall(registration.installing);
		};

		// The new worker takes over only after the reload was asked for; other
		// tabs get the same event and must not restart on someone else's click.
		const onControllerChange = () => {
			if (reloadRequested) location.reload();
		};
		container.addEventListener('controllerchange', onControllerChange);

		(async () => {
			// A registration that already has an active worker means this is a
			// return visit, not the install that first makes the app available.
			const firstInstall = !(await container.getRegistration())?.active;

			registration = await container.ready;
			if (firstInstall) {
				toast(m.offline.ready, {
					description: m.offline.readyDetail
				});
			}
			if (registration.waiting) offerUpdate(registration.waiting);
			if (registration.installing) watchInstall(registration.installing);
			registration.addEventListener('updatefound', onUpdateFound);
		})();

		return () => {
			container.removeEventListener('controllerchange', onControllerChange);
			registration?.removeEventListener('updatefound', onUpdateFound);
		};
	});
</script>
