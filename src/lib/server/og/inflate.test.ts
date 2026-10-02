import { describe, expect, it } from 'vitest';
import { gzipSync } from 'fflate';
import { inflateAtMost } from './inflate';

function gz(bytes: Uint8Array): ArrayBuffer {
	const out = gzipSync(bytes);
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

/** The same member with its trailer claiming a different size. */
function claiming(member: ArrayBuffer, size: number): ArrayBuffer {
	const copy = member.slice(0);
	new DataView(copy).setUint32(copy.byteLength - 4, size, true);
	return copy;
}

describe('inflateAtMost', () => {
	const data = new Uint8Array(4000).map((_, i) => i % 251);

	it('inflates a member within the limit', () => {
		expect(new Uint8Array(inflateAtMost(gz(data), 4000)!)).toEqual(data);
	});

	it('refuses one that says it is larger', () => {
		expect(inflateAtMost(gz(data), 3999)).toBeNull();
	});

	it('refuses a trailer that claims gigabytes, without allocating them', () => {
		expect(inflateAtMost(claiming(gz(data), 0xffffffff), 4000)).toBeNull();
	});

	it('never returns more than the trailer allowed, even when it understates', () => {
		const out = inflateAtMost(claiming(gz(data), 100), 4000);
		expect(out?.byteLength).toBeLessThanOrEqual(100);
	});

	it('refuses what is not gzip at all', () => {
		expect(
			inflateAtMost(new TextEncoder().encode('{"rows":1,"columns":[]}').buffer, 4000)
		).toBeNull();
	});
});
