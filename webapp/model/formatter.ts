export default {
	statusText(sStatus: string): string {
		const mStatus: Record<string, string> = {
			"A": "New",
			"B": "In Progress",
			"C": "Done"
		};
		return mStatus[sStatus] || sStatus;
	}
};
