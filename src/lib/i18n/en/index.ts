/**
 * The English catalog: the source every other language mirrors.
 * One module per area of the app; `Messages` is its shape.
 */

import { common, format, nav, shell, progress, purpose, findings } from './core';
import { facts } from './facts';
import { columns } from './columns';
import { accountMenu } from './account';
import { wrapped } from './wrapped';
import { charts } from './charts';
import { range, dropZone, moved, offline, notices, errors } from './misc';
import { boards, claims, leaderboard } from './boards';
import { detail, exportMenu, shares, share, notes, sharedPage } from './detail';
import { tokens, library } from './library';
import { landing } from './landing';
import { site, featuresPage, faqPage } from './site';
import { verify, unsubscribe, accountPage } from './auth';
import { overview } from './overview';
import { insights, privacyPage } from './insights';
import { battery } from './battery';
import { charging } from './charging';
import { doorsPage, drivingPage } from './driving';
import { explorer } from './explorer';
import { dataPage } from './data';
import { logbookPage, labelPage, tripsPage } from './logbook';

export const en = {
	common,
	format,
	nav,
	shell,
	progress,
	purpose,
	findings,
	facts,
	columns,
	accountMenu,
	wrapped,
	charts,
	range,
	dropZone,
	moved,
	offline,
	notices,
	boards,
	claims,
	detail,
	exportMenu,
	shares,
	share,
	notes,
	tokens,
	library,
	landing,
	site,
	featuresPage,
	faqPage,
	verify,
	unsubscribe,
	accountPage,
	overview,
	insights,
	privacyPage,
	battery,
	charging,
	doorsPage,
	drivingPage,
	explorer,
	dataPage,
	logbookPage,
	labelPage,
	tripsPage,
	leaderboard,
	sharedPage,
	errors
};

/** The catalog's shape, with literal strings widened so a translation may say anything. */
type Widen<T> = T extends string
	? string
	: T extends (...args: infer A) => infer R
		? (...args: A) => Widen<R>
		: T extends readonly (infer U)[]
			? Widen<U>[]
			: T extends object
				? { [K in keyof T]: Widen<T[K]> }
				: T;

export type Messages = Widen<typeof en>;
