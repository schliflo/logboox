/**
 * Exercises the XPeng Open Platform export flow end to end from a terminal:
 * submit the task, wait until the file exists, download it before the link
 * expires.
 *
 *   pnpm xpeng:query [output.zip]
 *
 * Credentials come from the environment (see `.env.example`); the pnpm script
 * loads `.env` when present. Nothing secret is ever printed. The default
 * output lands in `.samples/`, which git ignores because exports carry the VIN.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import {
	LIMITS,
	downloadExport,
	pollUntilReady,
	type OpenEnv,
	type QueryDataResult
} from '../src/lib/xpeng-open/queryData.ts';

const REQUIRED = [
	'XPENG_APP_ID',
	'XPENG_APP_SECRET',
	'XPENG_OPEN_ID',
	'XPENG_ACCESS_TOKEN',
	'XPENG_ENTERPRISE_NAME',
	'XPENG_SCOPE_CODE'
] as const;

/** Exit codes, so a cron wrapper can tell "wait a day" from "owner must re-authorise". */
const EXIT: Record<QueryDataResult['kind'], number> = {
	ready: 0,
	exporting: 1,
	error: 1,
	limit: 3,
	unauthorized: 4,
	tokenExpired: 4,
	failed: 5,
	appError: 6
};

function explain(result: QueryDataResult): string {
	switch (result.kind) {
		case 'exporting':
			return 'XPeng is still generating the file';
		case 'ready':
			return 'file ready, downloading';
		case 'failed':
			return 'XPeng reports DataFileExportFailed; a retry counts as a new submission';
		case 'limit':
			return `submission budget (${LIMITS.submissionsPer24h} per 24 h) for this owner is used up`;
		case 'unauthorized':
			return `no authorisation for this owner and app (${result.code} ${result.desc}); the owner must authorise the enterprise again in the Data Center`;
		case 'tokenExpired':
			return `accessToken rejected (${result.code} ${result.desc}); the owner must authorise again`;
		case 'appError':
			return `appId, nonce or signature rejected (${result.code} ${result.desc}); check XPENG_APP_ID and XPENG_APP_SECRET`;
		case 'error':
			return `unexpected reply ${result.code} ${result.desc} (HTTP ${result.status})`;
	}
}

function elapsed(since: number): string {
	return `${((Date.now() - since) / 1000).toFixed(1)}s`;
}

async function main(): Promise<void> {
	const missing = REQUIRED.filter((name) => !process.env[name]);
	if (missing.length > 0) {
		console.error(
			`Missing ${missing.join(', ')}. Copy .env.example to .env and fill it in; see docs/xpeng-open-platform.md.`
		);
		process.exit(2);
	}
	const envName = process.env.XPENG_OPEN_ENV ?? 'uat';
	if (envName !== 'uat' && envName !== 'prod') {
		console.error(`XPENG_OPEN_ENV must be "uat" or "prod", not "${envName}".`);
		process.exit(2);
	}
	const env: OpenEnv = envName;
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const output = resolve(process.argv[2] ?? `.samples/xpeng-open-${env}-${stamp}.zip`);

	console.log(`env=${env} enterprise="${process.env.XPENG_ENTERPRISE_NAME}" output=${output}`);
	const started = Date.now();
	const result = await pollUntilReady({
		env,
		app: { appId: process.env.XPENG_APP_ID!, appSecret: process.env.XPENG_APP_SECRET! },
		owner: {
			openId: process.env.XPENG_OPEN_ID!,
			accessToken: process.env.XPENG_ACCESS_TOKEN!,
			enterpriseName: process.env.XPENG_ENTERPRISE_NAME!,
			scopeCode: process.env.XPENG_SCOPE_CODE!
		},
		onStatus: (status, attempt) =>
			console.log(`[${elapsed(started)}] attempt ${attempt}: ${explain(status)}`)
	});

	if (result.kind !== 'ready') {
		console.error(explain(result));
		process.exit(EXIT[result.kind]);
	}

	// The link lives about thirty seconds; fetch it before doing anything else.
	const { bytes, contentType } = await downloadExport(result.url);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, bytes);
	console.log(
		`[${elapsed(started)}] wrote ${bytes.byteLength} bytes (${contentType ?? 'unknown type'}) to ${output}`
	);
	console.log('Drop the file on the landing page of `pnpm dev` to confirm it parses.');
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
