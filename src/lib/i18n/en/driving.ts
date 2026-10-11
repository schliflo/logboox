export const doorsPage = {
	doors: {
		ldcu_driverdoorajarst: 'Driver',
		rdcu_psngrdoorajarst: 'Passenger',
		ldcu_rldoorajarst: 'Rear left',
		rdcu_rrdoorajarst: 'Rear right'
	} as Record<string, string>,
	wheels: ['Front left', 'Front right', 'Rear left', 'Rear right'],
	schedule: 'Your car knows your schedule',
	scheduleHint:
		'Every door opening, by weekday and hour. No location data is needed to see the shape of a week: this is only which door opened, and when.',
	openings: 'Door openings',
	openingsCount: (count: string) => `${count} openings`,
	recorded: 'Openings recorded',
	busiestHour: 'Busiest hour',
	neverBetween: 'Never once between',
	quietDetail: (hours: number) => `${hours} hours of complete quiet, every day`,
	longestOpen: 'Longest left open',
	aDoor: 'A door',
	doorName: (door: string) => `${door} door`,
	rearNote:
		"Rear doors opening means someone else was in the car. Taken together with the times, this is a month of a household's comings and goings, recorded to the second — from a signal that exists to warn you a door is ajar.",
	tyres: 'Tyre pressure, and the weather',
	tyresHint:
		'Daily median for each wheel. Pressure follows air temperature, so this doubles as a record of how warm the month was.',
	pressureRange: 'Pressure range',
	pressureSteps: 'Reported in steps of 2.75 kPa, which is why the lines look like stairs',
	change: 'Change over the month',
	front: 'kPa front',
	rear: (value: string) => `Rear ${value} kPa`,
	tracks: 'Tracks temperature',
	tracksDetail: 'Correlation with battery temperature, which follows the outside air',
	empty: 'Signals your car never filled in',
	emptyHint: 'These columns exist in every row of the export and are empty in all of them.',
	emptyNote:
		'The export uses one schema for every model XPeng sells, so a car reports blanks wherever it has no such hardware. Window positions and the tailgate opener are in the file for vehicles that report them; yours does not.'
};

export const drivingPage = {
	hardestBraking: 'Hardest braking',
	hardestAcceleration: 'Hardest acceleration',
	fastest: 'Fastest moments',
	topSpeed: 'Top speed',
	hardestStop: 'Hardest stop',
	emergency: 'Beyond 0.6 g is an emergency stop',
	hardestLaunch: 'Hardest launch',
	fullThrottle: 'Pulling away at full throttle',
	above100: 'Time above 100',
	ofMoving: (time: string) => `Of ${time} moving`,
	grip: 'How much grip you used',
	gripHint:
		'Every second of driving placed by the forces acting on the car: braking and accelerating up and down, cornering left and right. Careful driving fills a narrow cross, committed driving fills a circle.',
	speeds: 'Speeds you actually drive',
	speedsHint: 'Time spent at each speed, excluding standing still.',
	speedMoving: 'Speed while moving',
	pedal: 'How far you press the pedal',
	pedalHint: 'Accelerator position whenever it was pressed at all.',
	pedalLabel: 'Accelerator position',
	atSpeed: (speed: string) => `at ${speed} km/h`
};
