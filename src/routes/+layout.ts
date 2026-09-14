// Every page is static. The export is read and analysed entirely in the
// browser, which is what makes the privacy claim on the landing page true
// rather than merely a policy.
//
// The server routes this app does have — the account API, and the share pages
// under `/s` — opt out of prerendering individually. Endpoints never inherit
// this flag, so only pages have to say so.
export const prerender = true;
export const ssr = true;
