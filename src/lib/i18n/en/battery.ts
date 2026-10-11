export const battery = {
	fullRange: 'Full-charge range',
	fullRangeDetail: (min: string, max: string) =>
		`Typically ${min}–${max} km, from the car's own estimate`,
	lostParked: 'Lost while parked',
	lostParkedDetail: (count: number, hours: string) =>
		`Across ${count} long stands, totalling ${hours} hours`,
	packTemp: 'Pack temperature',
	spreadDetail: (spread: string) => `Widest spread within the pack was ${spread} °C`,
	socUsed: 'Charge range used',
	socUsedDetail: 'The band the battery actually lived in this month',
	monthOfCharge: 'A month of charge',
	monthOfChargeHint:
		'Every discharge and recharge. The line breaks where the car was asleep — it records nothing then, and drawing across the gap would imply otherwise.',
	charge: 'Charge',
	predicted: 'Predicted range',
	predictedHint: 'What the car told you it had left.',
	range: 'Range',
	packTempHint:
		'Warmest and coolest parts of the battery. The gap between them is the pack working to stay even.',
	warmest: 'Warmest',
	coolest: 'Coolest',
	standing: 'Charge lost standing still',
	standingHint:
		'Long periods with no driving and no charging. A parked car still runs its systems, and the charge quietly goes down.',
	parkedFrom: 'Parked from',
	for: 'For',
	lost: 'Lost'
};
