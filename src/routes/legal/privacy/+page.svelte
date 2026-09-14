<!--
  The privacy notice.

  Written around the one distinction that actually matters here: without an
  account nothing leaves the browser, and with one you can see exactly what
  does. Everything else follows from that, which is why the page is organised
  by "what happens if" rather than by article number.

  Not to be confused with /dash/privacy, which reads a particular export back
  and says what it reveals. That page is about the car; this one is about us.
-->
<script lang="ts">
	import Seo from '$lib/components/app/Seo.svelte';
</script>

<Seo
	title="Privacy"
	description="What LogbooX stores, when, and what it never sees."
	path="/legal/privacy"
/>

<h1 class="text-2xl font-semibold tracking-tight">Privacy</h1>
<p class="text-muted-foreground">Last updated 14 September 2026</p>

<p>
	LogbooX reads the vehicle data XPeng gives you under the EU Data Act. The reading happens in your
	browser. An account is optional, and it is the only thing that causes any of your data to reach a
	server at all.
</p>

<h2>Who is responsible</h2>
<p>
	Florian Schlittenbauer, at the address given in the <a href="/legal/imprint">imprint</a>, is the
	controller within the meaning of the GDPR. Contact details are there too.
</p>

<h2>Without an account</h2>
<p>
	Nothing about your vehicle reaches us. The export is parsed by code running inside the page and
	kept in your browser's own storage so you can reopen it; removing it is one click, and clearing
	site data removes everything at once. We never receive it, and there is no endpoint that would
	accept it.
</p>
<p>
	What does reach our infrastructure is what reaching any website involves: your IP address, the
	page requested, the time, and your browser's user agent, processed by Cloudflare as part of
	delivering the site and defending it against attack. The legal basis is our legitimate interest in
	operating a working service (Art. 6 (1) (f) GDPR).
</p>

<h2>With an account</h2>
<p>An account is an e-mail address. There is no password and no profile.</p>

<h3>What we store</h3>
<ul>
	<li>
		<strong>Your e-mail address</strong>, to sign you in and to send the messages you have asked
		for.
	</li>
	<li>
		<strong>Sign-in links</strong>, stored only as a hash, valid once and for fifteen minutes. The
		IP address that asked for one is kept beside it for up to 24 hours, purely to stop the form
		being used to send mail to other people.
	</li>
	<li>
		<strong>Sessions</strong>, as a cookie holding a random value and a hash of it here. Ninety
		days, renewed while you keep using it.
	</li>
	<li>
		<strong>Exports you choose to keep in the account</strong>: the compressed signal data, the
		vehicle identification number and model it carries, and the trips and charging sessions worked
		out from it. Only exports you explicitly copy up, or every new one if you switch that on.
	</li>
	<li>
		<strong>Logbook entries</strong> you write against trips — where you went, why, and any comment —
		once you are signed in.
	</li>
	<li><strong>API tokens</strong> you create, stored as hashes.</li>
	<li>
		<strong>Shared links and leaderboard places</strong> you create, described below.
	</li>
</ul>

<h3>Where it is stored</h3>
<p>
	On Cloudflare's infrastructure, in the European Union: the database and the object storage are
	both created in the EU jurisdiction. Cloudflare Inc. acts as our processor under a data processing
	agreement incorporating the EU standard contractual clauses.
</p>

<h3>Legal basis</h3>
<p>
	Performance of the contract you enter into by creating an account (Art. 6 (1) (b) GDPR) for
	everything that makes the account work. Consent (Art. 6 (1) (a)) for anything published — a shared
	link, a place on a leaderboard — which is why each one takes a deliberate action and can be
	withdrawn. Legitimate interest (Art. 6 (1) (f)) for rate limiting and for keeping the service
	standing up.
</p>

<h3>How long</h3>
<p>
	Until you delete it. "Delete this account" on the account page removes the rows and the stored
	files. Sign-in links are pruned a day after they expire, sessions once they lapse, and an upload
	that was never finished is swept up after a day.
</p>

<h2>What is published, and only when you say so</h2>
<p>
	<strong>Shared links</strong> make one trip, one charging session or a whole export readable by anyone
	holding the link. They carry the model of the car and never the vehicle identification number. You can
	revoke one at any time, and it stops working immediately.
</p>
<p>
	<strong>Leaderboards</strong> show a name you choose, the model of the car, the figure itself and the
	numbers beside it. They never show your e-mail address, your vehicle identification number, your odometer
	or the exact time anything happened. Nothing appears there automatically: the app tells you privately
	when something of yours would rank, and only you can put it up. You can take it down again at any time,
	including after a month has closed.
</p>

<h2>E-mail</h2>
<p>
	We send sign-in links, and — only if you leave them switched on — reminders to request your next
	export, messages when one of your trips would rank on a board, and a summary at the end of a year.
	Each kind has its own switch on the account page and its own unsubscribe link, so turning one off
	never affects the other. There are no tracking pixels and no click tracking; the messages are
	plain text with a plain HTML twin. Mail is delivered through Cloudflare's e-mail service.
</p>

<h2>Cookies</h2>
<p>
	Two, both strictly necessary, so there is no consent banner to click through (§ 25 (2) TTDSG):
</p>
<ul>
	<li>
		<code>lbx_session</code> — your sign-in, set only once you sign in. HttpOnly, ninety days.
	</li>
	<li>
		<code>sidebar_state</code> — whether the dashboard sidebar is open. A week.
	</li>
</ul>
<p>
	There is no analytics, no advertising, no third-party embed and no external font: everything the
	page loads comes from this site.
</p>

<h2>Your rights</h2>
<ul>
	<li>
		<strong>Access and portability.</strong> The API serves everything in your account as JSON, and "Back
		up" writes every export you keep as a single archive.
	</li>
	<li><strong>Rectification.</strong> Logbook entries and your name are editable at any time.</li>
	<li>
		<strong>Erasure.</strong> "Delete this account" removes everything. Individual exports, links and
		places can be removed on their own.
	</li>
	<li><strong>Objection and restriction</strong>, under Art. 21 and Art. 18 GDPR.</li>
	<li>
		<strong>Complaint.</strong> You may complain to a supervisory authority, in particular the one where
		you live. For this service that is [YOUR STATE DATA PROTECTION AUTHORITY].
	</li>
</ul>
<p>Write to the address in the imprint to exercise any of these.</p>

<h2>Changes</h2>
<p>
	This notice changes when the service does. The date at the top says when it last did; material
	changes to what an account stores will be said in the app rather than only here.
</p>
