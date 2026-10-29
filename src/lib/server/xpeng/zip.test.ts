import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { memoryBucket } from '../testing/memory-bucket';
import { zipMembers } from './zip';

async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new Response(stream).text();
}

describe('zipMembers', () => {
	it('streams each CSV out of the bucket, deflated or stored, as often as asked', async () => {
		const big = 'timer,vin\n' + Array.from({ length: 5000 }, (_, i) => `${i},L1N`).join('\n');
		const bucket = memoryBucket();
		await bucket.put(
			'x.zip',
			zipSync({
				'export/a_status.csv': strToU8(big),
				'b_power.csv': [strToU8('timer\n1'), { level: 0 }],
				'readme.txt': strToU8('not data'),
				'__MACOSX/._a.csv': strToU8('fork')
			})
		);

		const members = await zipMembers(bucket, 'x.zip');
		expect(members.map((m) => [m.name, m.size])).toEqual([
			['export/a_status.csv', big.length],
			['b_power.csv', 7]
		]);
		expect(await text(members[0].stream())).toBe(big);
		expect(await text(members[0].stream())).toBe(big);
		expect(await text(members[1].stream())).toBe('timer\n1');
	});

	it('refuses something that is not a ZIP', async () => {
		const bucket = memoryBucket();
		await bucket.put('x.zip', strToU8('plain text'));
		await expect(zipMembers(bucket, 'x.zip')).rejects.toThrow(/Not a ZIP/);
	});
});
