import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from './generator';
import { buildTeasers, DEMO_ZONE } from './teasers';
import { analyze } from '../data/analytics';

describe('landing teasers', () => {
	it('are cut from the demo month the app loads', async () => {
		// The defaults are what "Try it with a demo month" loads.
		const dataset = generateDemoDataset();
		const teasers = buildTeasers(dataset, analyze(dataset, DEMO_ZONE));
		await expect(`${JSON.stringify(teasers)}\n`).toMatchFileSnapshot('./teasers.json');
	});
});
