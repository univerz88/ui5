import { ValueState } from "sap/ui/core/library";

const DEADLINE = new Date("2026-05-31");
const WARN_DT = new Date("2026-05-14");

export interface StatusResult {
	lbl: string;
	state: ValueState;
	/** 0=마감초과, 1=위험, 2=정상, 3=일정미정 */
	s: 0 | 1 | 2 | 3;
}

function excelDateToJS(v: unknown): Date | null {
	if (v instanceof Date) return v;
	if (typeof v === "number" && v > 1) {
		return new Date(Math.round((v - 25569) * 864e5));
	}
	if (typeof v === "string") {
		const s = v.replace(/\s/g, "").replace(/-/g, "");
		if (s.length === 8) {
			return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
		}
	}
	return null;
}

function fmtDate(v: unknown): string {
	const d = excelDateToJS(v);
	if (!d || isNaN(d.getTime())) return "";
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function workdays(from: Date, to: Date): number {
	if (to < from) return 0;
	let n = 0;
	const d = new Date(from);
	d.setHours(0, 0, 0, 0);
	const t = new Date(to);
	t.setHours(0, 0, 0, 0);
	while (d <= t) {
		const w = d.getDay();
		if (w !== 0 && w !== 6) n++;
		d.setDate(d.getDate() + 1);
	}
	return n;
}

function getStatus(devPlanRaw: unknown, md: number, today: Date): StatusResult {
	const p = excelDateToJS(devPlanRaw);
	if (!p || isNaN(p.getTime())) return { lbl: "일정미정", state: ValueState.None, s: 3 };
	if (p > DEADLINE) return { lbl: "정상", state: ValueState.Success, s: 2 };
	const av = workdays(today, p);
	if (av < md) return { lbl: "마감초과", state: ValueState.Error, s: 0 };
	if (p > WARN_DT) return { lbl: "위험", state: ValueState.Warning, s: 1 };
	return { lbl: "정상", state: ValueState.Success, s: 2 };
}

function getZoneState(zone: string): ValueState {
	const map: Record<string, ValueState> = {
		CA: ValueState.Information,
		HQ: ValueState.Success,
		VN: ValueState.Warning,
	};
	return map[zone] ?? ValueState.None;
}

export default {
	excelDateToJS,
	fmtDate,
	workdays,
	getStatus,
	getZoneState,
	DEADLINE,
	WARN_DT,
};
