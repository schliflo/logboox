<!--
  Terms of use.

  Short, because the service is small and free, and because the two things
  that actually need saying are that the numbers are computed on your own
  machine out of a file we never see, and that a public board needs rules
  about names.
-->
<script lang="ts">
	import Seo from '$lib/components/app/Seo.svelte';
</script>

<Seo title="Terms" description="The terms LogbooX is offered under." path="/legal/terms" />

<h1 class="text-2xl font-semibold tracking-tight">Terms of use</h1>
<p class="text-muted-foreground">Last updated 14 September 2026</p>

<h2>What this is</h2>
<p>
	LogbooX reads the vehicle data export XPeng provides under the EU Data Act and makes it legible.
	It is offered free of charge, as-is, by the operator named in the <a href="/legal/imprint"
		>imprint</a
	>. It is an independent project with no connection to XPeng.
</p>

<h2>The numbers</h2>
<p>
	Nothing in this app is measured by us. Every figure is derived, in your own browser, from a file
	your car wrote — trips from gear position and odometer movement, charging sessions from the plug's
	power signal, energy by integrating voltage and current. The derivations are documented and they
	are careful, but they are inferences from raw signals, and they can be wrong where the data is
	sparse or the car behaved unusually.
</p>
<p>
	So: do not use this as the sole basis for anything that matters legally or financially. That
	includes the Fahrtenbuch. A logbook kept for tax purposes has requirements this app does not
	attempt to guarantee, and the app tells you when kilometres are unaccounted for precisely because
	it cannot vouch for the rest.
</p>

<h2>Accounts</h2>
<p>
	An account is optional and needs only an e-mail address you can read. You are responsible for
	keeping access to that inbox, since anyone who can read it can sign in. Do not use the service to
	store data about a vehicle you have no right to.
</p>

<h2>Names and leaderboards</h2>
<p>
	Putting something on a board is voluntary and reversible: you choose a name, you claim a place,
	and you can take it down at any time, including after the month has closed.
</p>
<p>A name must not:</p>
<ul>
	<li>impersonate another person, a company, or this service;</li>
	<li>be offensive, or promote anything hateful or illegal;</li>
	<li>be advertising.</li>
</ul>
<p>
	We may rename or remove an account that breaks this, and may remove a place whose figures are
	implausible. Boards apply automatic plausibility limits, but they rest in the end on people not
	wanting to cheat at a game about their own car. Treat them as entertainment. There are no prizes.
</p>

<h2>Shared links</h2>
<p>
	A shared link makes what it shows readable by anyone who has it. You decide what to publish and
	you are responsible for it. A link never carries the vehicle identification number, and revoking
	one takes effect immediately.
</p>

<h2>API tokens</h2>
<p>
	A token grants read access to your own data. Keep it as you would a password, and revoke it from
	the account page if it goes astray.
</p>

<h2>Availability</h2>
<p>
	There is no uptime promise. The service may change or stop. Exports kept only in your browser are
	unaffected by anything that happens to it, which is the reason the backup feature exists and the
	reason to use it.
</p>

<h2>Liability</h2>
<p>
	The operator is liable without limitation for damage caused intentionally or by gross negligence,
	and for injury to life, body or health. Otherwise liability is limited to a breach of an
	obligation essential to the purpose of the contract, and in that case to the damage typically
	foreseeable for a service of this kind. Liability under the Product Liability Act is unaffected.
</p>

<h2>Ending it</h2>
<p>
	Delete your account whenever you like, from the account page. We may close an account that breaks
	these terms, having said why where that is possible.
</p>

<h2>Law</h2>
<p>
	German law applies, without prejudice to mandatory consumer protection rules of the country you
	live in.
</p>

<h2>The software itself</h2>
<p>
	LogbooX is open source under the MIT licence. These terms cover the service running at this
	address, not the code, which you may run yourself on the terms of that licence.
</p>
