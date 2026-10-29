/** The German catalog. Its type is the English one, so no key can go missing. */

import type { Messages } from '../en/index';
import { common, format, nav, shell, progress, purpose, findings } from './core';
import { facts } from './facts';
import { columns } from './columns';
import { accountMenu } from './account';
import { wrapped } from './wrapped';
import { charts } from './charts';
import { range, dropZone, moved, offline, notices, report, errors } from './misc';
import { boards, claims, leaderboard } from './boards';
import { detail, exportMenu, shares, share, notes, sharedPage } from './detail';
import { tokens, library, xpeng } from './library';
import { landing } from './landing';
import { site, featuresPage, faqPage } from './site';
import { guidesPage, guides } from './guides';
import { verify, unsubscribe, accountPage } from './auth';
import { overview } from './overview';
import { insights, privacyPage } from './insights';
import { battery } from './battery';
import { charging } from './charging';
import { doorsPage, drivingPage } from './driving';
import { explorer } from './explorer';
import { dataPage } from './data';
import { logbookPage, labelPage, tripsPage } from './logbook';

export const de: Messages = {
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
	xpeng,
	library,
	landing,
	site,
	featuresPage,
	faqPage,
	guidesPage,
	guides,
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
	report,
	errors
};
