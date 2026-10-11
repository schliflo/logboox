export const charts = {
	gg: {
		aria: (seconds: string) =>
			`Cornering force against braking and acceleration, ${seconds} seconds of driving`,
		accelerating: 'accelerating',
		braking: 'braking',
		left: 'left',
		right: 'right',
		ofDriving: (share: string) => `${share}% of driving`,
		never: 'never went here',
		caption: (seconds: string, extent: string) =>
			`${seconds} seconds of driving. Rings mark quarter-g steps; the outer edge is ${extent} g.`
	},
	daily: {
		aria: 'Distance per day',
		notRecorded: 'not recorded',
		notRecordedTitle: 'Not recorded'
	},
	histogram: {
		distribution: 'Distribution',
		aria: (label: string, bins: number) => `${label}, ${bins} bins`,
		peak: (value: string) => `peak ${value}`,
		samples: (count: string, one: boolean) => `${count} ${one ? 'sample' : 'samples'}`
	},
	calendar: {
		distance: 'Distance',
		perDay: (label: string) => `${label} per day`,
		months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		notRecordedDay: (day: string) => `${day}, not recorded`,
		noExport: 'no export covers this day',
		busiest: 'the busiest day',
		rank: (place: number, of: number) => `${place} of ${of} days driven`,
		didNotMove: 'the car did not move',
		notRecorded: 'not recorded'
	},
	punchcard: {
		activity: 'Driving activity',
		aria: (label: string) => `${label}, by weekday and hour`,
		ofWeek: (share: string) => `${share}% of the week`,
		never: 'never',
		caption: (label: string) => `${label}, by hour of the day`,
		less: 'less',
		more: 'more'
	},
	uplot: {
		overTime: (labels: string) => `${labels} over time`
	}
};
