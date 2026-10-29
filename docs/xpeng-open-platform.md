# Fetching an owner's export through the XPeng Open Platform

Under the EU Data Act an XPeng owner can authorise a named third party to
receive their vehicle data. XPeng implements this as an Open Platform API that
a registered enterprise calls on the owner's behalf. This page records what the
process requires, in the order it has to happen, and what the API does and does
not deliver. It is written from XPeng's integration guide (v1.0, 2026-08-19),
the xpeng.com Data Act pages, an XPeng rejection e-mail, live endpoint probes
and community reports, all as of September 2026. The process is new and XPeng
support is still settling; expect slow and sometimes inconsistent replies.

The feature built on it, and how to switch it on: [auto-import.md](auto-import.md).

## What you get

**The same export as the Data Center, not a live feed.** One API call submits
an export task; repeating it returns the task's status and finally a download
link to the ZIP of CSVs an owner could also download by hand: a rolling thirty
days, one row per second while the car is awake, the files this app parses.
There is no state of charge, location or any live signal. XPeng told requesters
in July 2026 that "a direct, real-time API mechanism is currently under
development"; nothing has shipped. For live data the only route today is
[Enode](https://enode.com/blog/xpeng-innovating-enode-partnership), which has
its own official XPeng API and a paid production tier.

| Limit                                | Value                                                   |
| ------------------------------------ | ------------------------------------------------------- |
| Submissions per owner and enterprise | 5 in 24 hours                                           |
| Task record remembered               | 24 hours                                                |
| Download link valid                  | about 30 seconds                                        |
| Data window                          | rolling 30 days                                         |
| accessToken lifetime                 | undocumented; expiry needs the owner to authorise again |

Asking for the status of an existing task is not a new submission; an expired
task is resubmitted, which is. One pull per owner per day is the sensible
cadence.

## Two halves of credentials

- **Enterprise half**, e-mailed by XPeng once the application is approved:
  `appId` and `appSecret`. Every request is signed with them.
- **Owner half**, e-mailed to the vehicle owner after they authorise the
  enterprise in the Data Center: `openId`, `accessToken`, `enterpriseName`,
  `scopeCode`. The owner has to pass these to the enterprise; the guide
  describes no redirect or callback.

`enterpriseName` "must exactly match the name used during authorization
(including case and spaces); the system compares MD5 hashes." The same exact
matching applies to the enterprise application itself.

## Steps, in order

The ordering is the part that is easy to get wrong. XPeng approves an
enterprise only against an **existing owner authorisation** that names it. An
application sent before any owner has authorised the enterprise, or with a
different spelling or contact address, is answered with "the information
provided does not match a valid authorisation record".

### 1. Freeze the identity strings

For this project:

| Field                            | Value                    |
| -------------------------------- | ------------------------ |
| Integrating enterprise name      | `LogbooX`                |
| Third-party application name     | `logboox.app`            |
| Integration owner contact e-mail | `xpeng-data@logboox.app` |

The enterprise name is `LogbooX`, capital L and X: that is what XPeng approved, and case counts. The mailbox
must exist and be read before anything is filed: XPeng sends the credentials
and all review correspondence there.

### 2. An owner authorises the enterprise in the Data Center

1. Sign in at [xpeng.com/data-act/my-data](https://www.xpeng.com/data-act/my-data)
   ("Get my data" on the [Data Act page](https://www.xpeng.com/data-act)).
2. Use the third-party data authorisation. XPeng's FAQ: "authorize a third
   party through the Data Center by reviewing the requested data, confirming
   your authorization, and managing your permissions at any time."
3. Enter the three strings above exactly, and select every data category on
   offer.
4. Note the date and time, the VIN and the XPeng account e-mail; the
   enterprise cites them in its application. The owner receives the four owner
   credentials by e-mail, possibly only once the enterprise is approved.

### 3. The enterprise applies to the Open Platform

Send from the contact address to `glo.open@xpeng.com`, copy
`eu.data.support@xpeng.com`:

```
Subject: Open Platform application – third-party data access under EU Data Act (authorization record on file)

Dear XPENG Open Platform Team,

A vehicle owner has completed a data authorization for our enterprise in the XPENG Data Center (xpeng.com/data-act/my-data). Please find the matching enterprise details below and issue appId/appSecret for the /open/oauth2/queryData interface (UAT and production).

- Integrating enterprise name: logboox
- Third-party application name: logboox.app
- Integration owner contact email: xpeng-data@logboox.app

Matching authorization record:
- Vehicle owner XPENG account: <owner account e-mail>
- VIN: <VIN>
- Authorization completed on: <date, time, time zone>

Purpose: periodic retrieval of the Data Act export on behalf of consenting vehicle owners for personal vehicle analytics (self-hosted, no onward sharing, in line with Art. 6 Data Act).

Kind regards,
<name>, logboox
```

If XPeng answers with another mismatch, ask which field differed and ask
`eu.data.support@xpeng.com` to confirm what the Data Center stored.

### 4. Try it in UAT, then production

Copy `.env.example` to `.env`, fill in both halves, and run:

```sh
pnpm xpeng:query
```

The script submits the task, asks every eight seconds, downloads the file the
moment a link appears and writes it to `.samples/`. Drop that file on the
landing page of `pnpm dev`; if it opens, the API export is the format this app
already understands. Exit codes: 3 budget used up, 4 the owner must authorise
again, 5 XPeng failed to generate the file, 6 our own credentials are wrong.

## The API

`POST /open/oauth2/queryData` on `https://open-eu.uat.xpeng.com` (UAT) or
`https://open.xpeng.com` (production). Query parameters `appId`, `nonce`
(milliseconds since the epoch) and `sign`; JSON body with the four owner
credentials. Both hosts answer today: a made-up `appId` gets
`{"code":12061001,"msg":"Invalid appId"}` from UAT.

Signature (`src/lib/xpeng-open/sign.ts`): concatenate `body` + the body text
and `nonce` + the nonce, in key order; wrap with `appId` in front and
`appSecret` behind; SHA-1; lowercase hex. The body must be signed as the exact
bytes sent.

Replies carry `code`, `data`, `msg` and `desc`. Success is `code 0` in the guide but `code 200` from production (seen 2026-10-27); both are accepted. Branch on `code` and `desc`;
`msg` is localised. `src/lib/xpeng-open/queryData.ts` maps them:

| Reply                                                      | Meaning                                             |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `code 0`, `data "DataFileExporting"`                       | task submitted or generating; ask again in 5–10 s   |
| `code 0`, `data` is a URL                                  | ready; download within about 30 s                   |
| `code 0`, `data "DataFileExportFailed"`                    | XPeng failed; resubmitting counts                   |
| `12064024`                                                 | five submissions in 24 h already                    |
| `12064019`, `12064018`                                     | no authorisation for this owner and app             |
| `4004001`, `12061014`                                      | accessToken expired or rejected                     |
| `12061001`, `12061002`, `12061004`, `12061005`, `12060001` | our appId, nonce, signature or parameters are wrong |

## Legal footing

Data Act, Regulation (EU) 2023/2854. Article 5 gives the user the right to have
readily available data made available to a third party, free of charge to the
user; natural persons qualify, only DMA gatekeepers are excluded. Article 6
binds the third party: process only for the purpose agreed with the user, no
profiling beyond what the service needs, no onward sharing without a contract,
erase the data when no longer needed. XPeng's forms say "enterprise", so a
company identity meets less friction, but a private applicant is within the
regulation.

## Sources

- [XPeng Open Platform `/oauth2/queryData` Integration Guide v1.0](https://static-eu.xiaopeng.com/xp-ucenter/api-integration-guide-en-0.0.1.html)
- [XPeng EU Data Act page](https://www.xpeng.com/data-act) and [Data Center](https://www.xpeng.com/data-act/my-data)
- [XPeng notice in German](https://www.xpeng.com/article/1696) and [in Dutch](https://www.xpeng.com/article/1716)
- [xpeng-fahrer.de thread on the Data Act portal and API](https://xpeng-fahrer.de/t/xpeng-eu-data-act-zugriff-auf-daten-nun-moeglich/16743)
- [evcc discussion with XPeng's reply about a real-time API](https://github.com/evcc-io/evcc/discussions/25819)
- [Data Act Article 5](https://www.eu-data-act.com/Data_Act_Article_5.html) and [Article 6](https://www.eu-data-act.com/Data_Act_Article_6.html)
