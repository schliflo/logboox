# The LogbooX API

Read your own data: the cars an account knows about, their trips and charging
sessions, and the last state each one reported. It exists so the exports you
have already imported can reach somewhere else — a home automation system, a
spreadsheet, a script that works out what a year of commuting cost.

It reads. Nothing here changes anything, and a token cannot create another
token or touch the account itself.

## What the data is, and is not

Everything served here was derived **in your browser**, at the moment an export
was imported, and uploaded with it. The server never parses telemetry — a month
inflates to several hundred megabytes, and the Worker that answers these
requests has 128.

That has one consequence worth being plain about: **this is not live**. XPeng
issues an export covering a rolling thirty days, on request. The freshest thing
here is as old as your most recent import. A sensor built on it tells you what
the car did, not what it is doing.

## Getting a token

Sign in at [logboox.app](https://logboox.app), open **Account**, and press
**New token**. The token is shown once. It looks like:

```
lbx_xUu1oQ3n8Yk4l2pR7sTvWzA0bC5dE6fG9hJkLmNoPqR
```

Only its hash is stored, so a lost token cannot be recovered — revoke it and
make another. Revoking takes effect immediately.

Send it as a bearer token:

```bash
curl -H "Authorization: Bearer $LOGBOOX_TOKEN" https://logboox.app/api/v1/vehicles
```

## Endpoints

All responses are JSON. Times are Unix epoch **seconds**. A value the export
never reported is `null` rather than zero.

### `GET /api/v1/vehicles`

Every car in the account, with its latest known state. One request, no paging —
this is the one to poll.

```json
{
	"vehicles": [
		{
			"vin": "L1NT…0293",
			"model": "F30b",
			"state": {
				"asOf": 1788134400,
				"odometerKm": 41207,
				"soc": 62,
				"rangeKm": 310
			},
			"coverage": { "from": 1785542400, "to": 1788134400, "exports": 3 },
			"counts": { "trips": 128, "chargingSessions": 21 }
		}
	]
}
```

`state.asOf` is the last sample in the newest export, and the honest timestamp
for everything beside it.

### `GET /api/v1/vehicles/{vin}/trips`

Trips, newest first.

| Parameter | Meaning                            | Default |
| --------- | ---------------------------------- | ------- |
| `from`    | Earliest start time, epoch seconds | none    |
| `to`      | Latest start time, epoch seconds   | none    |
| `limit`   | How many to return, at most 500    | 100     |

```json
{
	"vin": "L1NT…0293",
	"limit": 100,
	"trips": [
		{
			"startTime": 1788121500,
			"endTime": 1788123300,
			"odoStart": 41187,
			"odoEnd": 41207,
			"distanceKm": 20.0,
			"movingSeconds": 1500,
			"avgSpeed": 48.0,
			"maxSpeed": 112,
			"socStart": 80,
			"socEnd": 74,
			"energyKwh": 4.1,
			"regenKwh": 0.6,
			"consumption": 17.5,
			"exportId": "DA2026090112310"
		}
	]
}
```

A trip is identified by `startTime`. That is deliberate: array positions do not
survive re-importing or merging exports, and the odometer readings are what let
a trip be recognised again even when its boundaries shift by a second.

### `GET /api/v1/vehicles/{vin}/charging`

The same window parameters, for charging sessions.

```json
{
	"vin": "L1NT…0293",
	"limit": 100,
	"charging": [
		{
			"startTime": 1788100000,
			"endTime": 1788110800,
			"odometer": 41187,
			"socStart": 32,
			"socEnd": 80,
			"kwhDelivered": 38.4,
			"maxKw": 11.0,
			"isDc": false,
			"exportId": "DA2026090112310"
		}
	]
}
```

### `GET /api/v1/me`

The account itself: address, settings, and how much room the exports are using.
Useful as a check that a token works.

## Errors

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| 401    | No credential, or one that is not valid                 |
| 403    | A token tried something only the app may do             |
| 404    | No car with that identifier in this account             |
| 503    | Reached a deployment with no account database behind it |

The body is `{ "error": "…", "hint": "…" }`, written to be read by a person.

## With Home Assistant

A REST sensor per car. The export window means once or twice a day is plenty;
polling faster asks the same question of the same weeks-old data.

```yaml
# configuration.yaml
rest:
  - resource: https://logboox.app/api/v1/vehicles
    headers:
      Authorization: !secret logboox_token
    scan_interval: 21600 # six hours
    sensor:
      - name: Car odometer
        value_template: '{{ value_json.vehicles[0].state.odometerKm }}'
        unit_of_measurement: km
        device_class: distance
        state_class: total_increasing
      - name: Car charge
        value_template: '{{ value_json.vehicles[0].state.soc }}'
        unit_of_measurement: '%'
        device_class: battery
      - name: Car range
        value_template: '{{ value_json.vehicles[0].state.rangeKm }}'
        unit_of_measurement: km
        device_class: distance
      - name: Car data age
        value_template: >-
          {{ ((now().timestamp() - value_json.vehicles[0].state.asOf) / 86400) | round(1) }}
        unit_of_measurement: d
```

```yaml
# secrets.yaml
logboox_token: Bearer lbx_xUu1oQ3n8Yk4l2pR7sTvWzA0bC5dE6fG9hJkLmNoPqR
```

That last sensor is the one worth putting on a dashboard: it says how stale the
rest of them are, and it is the cue to request a new export.
