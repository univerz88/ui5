import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Table from "sap/m/Table";
import ColumnListItem from "sap/m/ColumnListItem";
import GroupHeaderListItem from "sap/m/GroupHeaderListItem";
import Text from "sap/m/Text";
import ObjectStatus from "sap/m/ObjectStatus";
import ProgressIndicator from "sap/m/ProgressIndicator";
import Dialog from "sap/m/Dialog";
import MessageStrip from "sap/m/MessageStrip";
import IconTabBar from "sap/m/IconTabBar";
import IconTabFilter from "sap/m/IconTabFilter";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import { ValueState } from "sap/ui/core/library";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { IconTabBar$SelectEvent } from "sap/m/IconTabBar";
import VizFrame from "sap/viz/ui5/controls/VizFrame";
import FlattenedDataset from "sap/viz/ui5/data/FlattenedDataset";
import DimensionDefinition from "sap/viz/ui5/data/DimensionDefinition";
import MeasureDefinition from "sap/viz/ui5/data/MeasureDefinition";
import FeedItem from "sap/viz/ui5/controls/common/feeds/FeedItem";
import * as XLSX from "xlsx";
import formatter from "../model/formatter";

// ── 상수 ──────────────────────────────────────────────────────────
const DEADLINE = new Date("2026-05-31");
const WARN_DT = new Date("2026-05-14");
const MODS = ["SD", "MM", "PP", "FI", "CO", "CM"] as const;
type ModKey = (typeof MODS)[number];

const BASE_C = {
	mod: 1, serial: 2, zone: 4, name: 6,
	designer: 19, designP: 20, designA: 21, diff: 22, md: 23,
	devWho: 24, devPlan: 25, devAct: 26,
};

const ZONE_LABEL: Record<string, string> = { CA: "공통", HQ: "본사", VN: "베트남" };

// ── 타입 ──────────────────────────────────────────────────────────
interface RowData {
	no: string;
	mod: string;
	zone: string;
	name: string;
	md: number;
	designer: string;
	designPRaw: unknown;
	designARaw: unknown;
	designP: string;
	designA: string;
	diff: string;
	devWho: string;
	devPlanRaw: unknown;
	devActRaw: unknown;
	devPlan: string;
	devAct: string;
}

/**
 * @namespace sap.dev.dashboard.controller
 */
export default class Main extends BaseController {
	private _modData: Partial<Record<ModKey, RowData[]>> = {};
	private _today: Date = new Date();
	private _curMod = "ALL";
	private _curZone = "ALL";
	private _oModel!: JSONModel;

	// ────────────────────────────────────────────────────────────────
	// 생명주기
	// ────────────────────────────────────────────────────────────────
	public onInit(): void {
		this._oModel = new JSONModel({
			isLoaded: false,
			baseDateDisplay: "기준일: —",
			moduleCounts: { ALL: 0, SD: 0, MM: 0, PP: 0, FI: 0, CO: 0, CM: 0 },
			kpi: {
				total: 0, designDone: 0, devDone: 0,
				remain: 0, remainMD: 0, deadlineDays: 0,
				devPct: "0.0", designPct: "0.0",
				designToDevPct: "0.0", devPctNum: 0,
				designPctNum: 0, designToDevPctNum: 0,
				modLabel: "전체 모듈",
				deadlineColor: "Neutral",
				designedNotDevCount: 0, noDesignCount: 0,
			},
			progressZones: [],
			charts: { zoneBar: [], mdDonut: [], statusBar: [] },
			summary: { total: 0, totalMD: 0, ok: 0, risk: 0, overAndNone: 0 },
			modal1: { subTitle: "", items: [] },
			modal2: { subTitle: "", items: [] },
		});
		this.getView()!.setModel(this._oModel, "dashboard");
	}

	// ────────────────────────────────────────────────────────────────
	// 파일 업로드
	// ────────────────────────────────────────────────────────────────
	public onFileChange(event: FileUploader$ChangeEvent): void {
		const files = event.getParameter("files") as FileList;
		if (!files?.length) return;

		const file = files[0];
		this._setBanner("Information", `"${file.name}" 읽는 중...`);

		const reader = new FileReader();
		reader.onload = (ev: ProgressEvent<FileReader>) => {
			try {
				const wb = XLSX.read(ev.target!.result as ArrayBuffer, {
					type: "array", cellDates: false, raw: true,
				});
				this._processAll(wb, file.name);
			} catch (err) {
				this._setBanner("Error", `파일 읽기 실패: ${String(err)}`);
			}
		};
		reader.readAsArrayBuffer(file);
	}

	// ────────────────────────────────────────────────────────────────
	// 데이터 파싱
	// ────────────────────────────────────────────────────────────────
	private _processAll(wb: XLSX.WorkBook, fileName: string): void {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		this._today = today;
		this._modData = {};
		const found: string[] = [];

		MODS.forEach(mod => {
			if (!wb.SheetNames.includes(mod)) return;

			const ws = wb.Sheets[mod];
			const raw = XLSX.utils.sheet_to_json(ws, {
				header: 1, defval: "", raw: true,
			}) as unknown[][];

			const offset = this._detectOffset(raw, mod);
			const C: Record<string, number> = {};
			for (const k in BASE_C) {
				C[k] = BASE_C[k as keyof typeof BASE_C] + offset;
			}

			// 집계행("계") 다음부터 데이터 시작
			let dataStart = -1;
			for (let i = 0; i < raw.length; i++) {
				if (String(raw[i][C.mod] ?? "").replace(/'/g, "").trim() === "계") {
					dataStart = i + 1;
					break;
				}
			}
			if (dataStart === -1) {
				for (let i = 0; i < raw.length; i++) {
					if (String(raw[i][C.mod] ?? "").replace(/'/g, "").trim().toUpperCase() === mod) {
						dataStart = i;
						break;
					}
				}
			}
			if (dataStart === -1) return;

			const rows: RowData[] = [];
			for (let i = dataStart; i < raw.length; i++) {
				const r = raw[i];
				if (String(r[C.mod] ?? "").replace(/'/g, "").trim().toUpperCase() !== mod) continue;

				const serial = String(r[C.serial] ?? "").replace(/'/g, "").trim();
				const name = String(r[C.name] ?? "").replace(/'/g, "").trim();
				if (!serial || !name) continue;

				const mdRaw = r[C.md];
				const md = mdRaw !== "" && !isNaN(Number(mdRaw)) ? Number(mdRaw) : 0;

				rows.push({
					no: serial.padStart(4, "0"),
					mod,
					zone: String(r[C.zone] ?? "").replace(/'/g, "").trim().toUpperCase(),
					name,
					md,
					designer: String(r[C.designer] ?? "").replace(/'/g, "").trim(),
					designPRaw: r[C.designP], designARaw: r[C.designA],
					designP: formatter.fmtDate(r[C.designP]),
					designA: formatter.fmtDate(r[C.designA]),
					diff: String(r[C.diff] ?? "").replace(/'/g, "").trim(),
					devWho: String(r[C.devWho] ?? "").replace(/'/g, "").trim(),
					devPlanRaw: r[C.devPlan], devActRaw: r[C.devAct],
					devPlan: formatter.fmtDate(r[C.devPlan]),
					devAct: formatter.fmtDate(r[C.devAct]),
				});
			}
			if (rows.length) { this._modData[mod] = rows; found.push(mod); }
		});

		if (!found.length) {
			this._setBanner("Error", "SD/MM/PP/FI/CO/CM 시트를 찾을 수 없습니다.");
			return;
		}

		const total = found.reduce((s, m) => s + (this._modData[m as ModKey]?.length ?? 0), 0);
		const todayStr = formatter.fmtDate(today) || today.toISOString().slice(0, 10);

		this._setBanner("Success",
			`✓ "${fileName}" 파싱 완료 · ${found.join("+")} ${total}개 프로그램 · 기준일: ${todayStr}`
		);

		const moduleCounts: Record<string, number> = { ALL: total };
		MODS.forEach(m => { moduleCounts[m] = this._modData[m]?.length ?? 0; });

		this._oModel.setProperty("/moduleCounts", moduleCounts);
		this._oModel.setProperty("/baseDateDisplay", `기준일: ${todayStr}`);
		this._oModel.setProperty("/isLoaded", true);

		this._curMod = "ALL";
		this._curZone = "ALL";
		this._switchModule("ALL");
	}

	private _detectOffset(raw: unknown[][], mod: string): number {
		for (let i = 0; i < Math.min(raw.length, 30); i++) {
			const row = raw[i] as unknown[];
			for (let j = 0; j < Math.min(row.length, 5); j++) {
				if (String(row[j] ?? "").replace(/'/g, "").trim().toUpperCase() === mod)
					return j - BASE_C.mod;
			}
		}
		return 0;
	}

	// ────────────────────────────────────────────────────────────────
	// 모듈 / 구분 탭 이벤트
	// ────────────────────────────────────────────────────────────────
	public onModuleSelect(event: IconTabBar$SelectEvent): void {
		this._switchModule(event.getParameter("key") as string);
	}

	public onZoneSelect(event: IconTabBar$SelectEvent): void {
		const zone = event.getParameter("key") as string;
		this._curZone = zone;
		this._renderTable(this._getCurData(), zone);
	}

	private _switchModule(mod: string): void {
		this._curMod = mod;
		this._curZone = "ALL";
		const data = this._getCurData();
		this._updateKPI(data, mod);
		this._updateProgress(data);
		this._updateCharts(data);
		this._updateZoneTabs(data);
		this._renderTable(data, "ALL");
	}

	private _getCurData(): RowData[] {
		if (this._curMod === "ALL")
			return Object.values(this._modData).flat() as RowData[];
		return this._modData[this._curMod as ModKey] ?? [];
	}

	// ────────────────────────────────────────────────────────────────
	// KPI 계산
	// ────────────────────────────────────────────────────────────────
	private _updateKPI(data: RowData[], mod: string): void {
		const total = data.length;
		const designDone = data.filter(r => r.designA).length;
		const devDone = data.filter(r => r.devAct).length;
		const remain = data.filter(r => !r.devAct);
		const remainMD = remain.reduce((s, r) => s + r.md, 0);
		const dlDays = formatter.workdays(this._today, DEADLINE);

		const devPctNum = total ? devDone / total * 100 : 0;
		const designPctNum = total ? designDone / total * 100 : 0;
		const designToDevPctNum = designDone ? devDone / designDone * 100 : 0;

		let deadlineColor: string;
		if (dlDays < 20) deadlineColor = "Critical";
		else if (dlDays < 35) deadlineColor = "Critical";
		else deadlineColor = "Good";

		this._oModel.setProperty("/kpi", {
			total, designDone, devDone,
			remain: remain.length, remainMD, deadlineDays: dlDays,
			devPct: devPctNum.toFixed(1),
			designPct: designPctNum.toFixed(1),
			designToDevPct: designToDevPctNum.toFixed(1),
			devPctNum: Math.round(devPctNum),
			designPctNum: Math.round(designPctNum),
			designToDevPctNum: Math.round(designToDevPctNum),
			modLabel: mod === "ALL" ? "전체 모듈" : mod + " 모듈",
			deadlineColor,
			designedNotDevCount: designDone - devDone,
			noDesignCount: total - designDone,
		});
	}

	// ────────────────────────────────────────────────────────────────
	// 구분별 진행률
	// ────────────────────────────────────────────────────────────────
	private _updateProgress(data: RowData[]): void {
		const zones = this._zones(data);
		const progressZones = zones.map(z => {
			const zr = data.filter(r => r.zone === z);
			const done = zr.filter(r => r.devAct).length;
			const remain = zr.filter(r => !r.devAct).length;
			const remainMD = zr.filter(r => !r.devAct).reduce((s, r) => s + r.md, 0);
			const pct = zr.length ? Math.round(done / zr.length * 100) : 0;
			return {
				zone: z,
				label: `${z} (${ZONE_LABEL[z] ?? z})`,
				done, total: zr.length, pct, remain, remainMD,
			};
		});
		this._oModel.setProperty("/progressZones", progressZones);
	}

	// ────────────────────────────────────────────────────────────────
	// 차트 데이터
	// ────────────────────────────────────────────────────────────────
	private _updateCharts(data: RowData[]): void {
		const remain = data.filter(r => !r.devAct);
		const zones = this._zones(data);

		const zoneBar = zones.map(z => ({
			zone: z,
			done: data.filter(r => r.zone === z && r.devAct).length,
			remain: data.filter(r => r.zone === z && !r.devAct).length,
		}));

		const mdDonut = zones.map(z => ({
			zone: z,
			md: remain.filter(r => r.zone === z).reduce((s, r) => s + r.md, 0),
		}));

		const statusBar = zones.map(z => {
			const zr = remain.filter(r => r.zone === z);
			let over = 0, risk = 0, ok = 0, none = 0;
			zr.forEach(r => {
				const st = formatter.getStatus(r.devPlanRaw, r.md, this._today);
				if (st.s === 0) over += r.md;
				else if (st.s === 1) risk += r.md;
				else if (st.s === 2) ok += r.md;
				else none += r.md;
			});
			return { zone: z, over, risk, ok, none };
		});

		this._oModel.setProperty("/charts", { zoneBar, mdDonut, statusBar });

		// VizFrame 데이터 및 색상 적용
		this._setVizDataset();
	}

	private _setVizDataset(): void {
		const charts = this._oModel.getProperty("/charts") as {
			zoneBar: Array<{ zone: string; done: number; remain: number }>;
			mdDonut: Array<{ zone: string; md: number }>;
			statusBar: Array<{ zone: string; over: number; risk: number; ok: number; none: number }>;
		};

		// 차트 1: 구분별 완료/잔여
		const oZoneBar = this.byId("zoneBarChart") as VizFrame | undefined;
		if (oZoneBar) {
			const oDs = new FlattenedDataset({
				data: { path: "/" },
				dimensions: [new DimensionDefinition({ name: "구분", value: "{zone}" })],
				measures: [
					new MeasureDefinition({ name: "완료", value: "{done}" }),
					new MeasureDefinition({ name: "잔여", value: "{remain}" }),
				],
			});
			oDs.setModel(new JSONModel(charts.zoneBar));
			oZoneBar.setDataset(oDs);
			oZoneBar.removeAllFeeds();
			oZoneBar.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["완료", "잔여"] }));
			oZoneBar.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["구분"] }));
		}

		// 차트 2: M/D 도넛
		const oDonut = this.byId("mdDonutChart") as VizFrame | undefined;
		if (oDonut) {
			const oDs = new FlattenedDataset({
				data: { path: "/" },
				dimensions: [new DimensionDefinition({ name: "구분", value: "{zone}" })],
				measures: [new MeasureDefinition({ name: "잔여 M/D", value: "{md}" })],
			});
			oDs.setModel(new JSONModel(charts.mdDonut));
			oDonut.setDataset(oDs);
			oDonut.removeAllFeeds();
			oDonut.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["잔여 M/D"] }));
			oDonut.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["구분"] }));
		}

		// 차트 3: 상태별 M/D
		const oStatusBar = this.byId("statusBarChart") as VizFrame | undefined;
		if (oStatusBar) {
			const oDs = new FlattenedDataset({
				data: { path: "/" },
				dimensions: [new DimensionDefinition({ name: "구분", value: "{zone}" })],
				measures: [
					new MeasureDefinition({ name: "마감초과", value: "{over}" }),
					new MeasureDefinition({ name: "위험", value: "{risk}" }),
					new MeasureDefinition({ name: "정상", value: "{ok}" }),
					new MeasureDefinition({ name: "일정미정", value: "{none}" }),
				],
			});
			oDs.setModel(new JSONModel(charts.statusBar));
			oStatusBar.setDataset(oDs);
			oStatusBar.removeAllFeeds();
			oStatusBar.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["마감초과", "위험", "정상", "일정미정"] }));
			oStatusBar.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["구분"] }));
		}

		this._applyChartColors();
	}

	private _applyChartColors(): void {
		const fnApply = () => {
			const oZoneBar = this.byId("zoneBarChart") as VizFrame | undefined;
			if (oZoneBar) {
				oZoneBar.setVizProperties({
					title: { visible: false },
					legend: { visible: true },
					plotArea: {
						colorPalette: ["#059669", "#fca5a5"],
					},
				});
			}
			const oStatusBar = this.byId("statusBarChart") as VizFrame | undefined;
			if (oStatusBar) {
				oStatusBar.setVizProperties({
					title: { visible: false },
					legend: { visible: true },
					plotArea: {
						colorPalette: ["#dc2626", "#d97706", "#059669", "#d1d5db"],
					},
				});
			}
			const oDonut = this.byId("mdDonutChart") as VizFrame | undefined;
			if (oDonut) {
				oDonut.setVizProperties({
					title: { visible: false },
					legend: { visible: true },
					plotArea: {
						colorPalette: ["#2563eb", "#7c3aed", "#059669"],
					},
				});
			}
		};
		// 렌더링 이후 적용
		setTimeout(fnApply, 100);
	}

	// ────────────────────────────────────────────────────────────────
	// 구분 탭 (CA / HQ / VN) 동적 업데이트
	// ────────────────────────────────────────────────────────────────
	private _updateZoneTabs(data: RowData[]): void {
		const remain = data.filter(r => !r.devAct);
		const zones = this._zones(data);
		const oTabBar = this.byId("zoneTabBar") as IconTabBar;
		oTabBar.removeAllItems();

		const totalMD = remain.reduce((s, r) => s + r.md, 0);
		oTabBar.addItem(new IconTabFilter({
			key: "ALL",
			text: `전체 (${remain.length}개 · ${totalMD} M/D)`,
		}));

		zones.forEach(z => {
			const zr = remain.filter(r => r.zone === z);
			if (!zr.length) return;
			const zMD = zr.reduce((s, r) => s + r.md, 0);
			oTabBar.addItem(new IconTabFilter({
				key: z,
				text: `${z} → ${zr.length}개 · ${zMD} M/D`,
			}));
		});

		oTabBar.setSelectedKey("ALL");
	}

	// ────────────────────────────────────────────────────────────────
	// 잔여 테이블 렌더
	// ────────────────────────────────────────────────────────────────
	private _renderTable(data: RowData[], zone: string): void {
		this._curZone = zone;
		const remain = data.filter(r => !r.devAct);
		const rows = zone === "ALL" ? remain : remain.filter(r => r.zone === zone);

		// 요약 계산
		let ok = 0, risk = 0, overAndNone = 0;
		rows.forEach(r => {
			const st = formatter.getStatus(r.devPlanRaw, r.md, this._today);
			if (st.s === 2) ok++;
			else if (st.s === 1) risk++;
			else overAndNone++;
		});
		this._oModel.setProperty("/summary", {
			total: rows.length,
			totalMD: rows.reduce((s, r) => s + r.md, 0),
			ok, risk, overAndNone,
		});

		// 테이블 아이템 프로그래매틱 생성 (그룹헤더 혼합)
		const oTable = this.byId("remainingTable") as Table;
		oTable.removeAllItems();

		const allZones = this._zones(data);
		const displayZones = zone === "ALL" ? allZones : [zone];

		displayZones.forEach(z => {
			const zr = rows.filter(r => r.zone === z);
			if (!zr.length) return;

			const zMD = zr.reduce((s, r) => s + r.md, 0);
			oTable.addItem(new GroupHeaderListItem({
				title: `${z} (${ZONE_LABEL[z] ?? z})  —  ${zr.length}개 / ${zMD} M/D`,
			}));

			zr.forEach(r => {
				const dp = formatter.excelDateToJS(r.devPlanRaw);
				const av = dp && !isNaN(dp.getTime()) ? formatter.workdays(this._today, dp) : null;
				const gap = av !== null ? av - r.md : null;
				const st = formatter.getStatus(r.devPlanRaw, r.md, this._today);
				const pct = av ? Math.min(100, Math.round((r.md / Math.max(av, 1)) * 100)) : 100;

				const gapTxt = gap === null ? "—" : (gap >= 0 ? `+${gap}일` : `${gap}일`);
				const gapState = gap === null ? ValueState.None : (gap < 0 ? ValueState.Error : ValueState.Success);

				oTable.addItem(new ColumnListItem({
					type: "Inactive",
					cells: [
						new Text({ text: r.no, wrapping: false }).addStyleClass("devDashMono"),
						new ObjectStatus({
							text: r.zone,
							state: formatter.getZoneState(r.zone),
						}),
						new Text({ text: r.name }),
						new Text({
							text: r.devPlan || "미정",
							wrapping: false,
						}).addStyleClass("devDashMono devDashDateCell"),
						new Text({ text: String(r.md || "—"), wrapping: false }).addStyleClass("devDashMono"),
						new Text({
							text: av !== null ? `${av}일` : "—",
							wrapping: false,
						}).addStyleClass("devDashMono"),
						new ObjectStatus({ text: gapTxt, state: gapState }),
						new ObjectStatus({ text: st.lbl, state: st.state }),
						new ProgressIndicator({
							percentValue: pct,
							displayValue: `${pct}%`,
							state: st.state === ValueState.Error ? "Error"
								: st.state === ValueState.Warning ? "Warning" : "None",
							height: "8px",
						}),
					],
				}));
			});
		});
	}

	// ────────────────────────────────────────────────────────────────
	// 모달 1: 설계완료 후 미개발
	// ────────────────────────────────────────────────────────────────
	public onOpenModal1(): void {
		const all = this._getCurData()
			.filter(r => r.designA && !r.devAct)
			.sort(this._sortByDevPlan.bind(this));

		const items = all.map(r => {
			const st = formatter.getStatus(r.devPlanRaw, r.md, this._today);
			const doneDate = formatter.excelDateToJS(r.designARaw);
			const elapsed = doneDate ? formatter.workdays(doneDate, this._today) : null;
			return {
				no: r.no,
				zone: r.zone,
				zoneState: formatter.getZoneState(r.zone),
				name: r.name,
				designA: r.designA || "—",
				devPlan: r.devPlan || "미정",
				devWho: r.devWho || "—",
				md: r.md ? String(r.md) : "—",
				statusLbl: st.lbl,
				statusState: st.state,
				elapsedTxt: elapsed !== null ? `${elapsed}일 경과` : "",
			};
		});

		const tmd = all.reduce((s, r) => s + r.md, 0);
		this._oModel.setProperty("/modal1", {
			subTitle: `설계 실적 완료 후 개발 미착수  ·  총 ${tmd} M/D  ·  개발 계획일 기준 정렬`,
			items,
		});

		this._rebuildModal1ZoneTabs(all);
		(this.byId("designedNotDevDialog") as Dialog).open();
	}

	public onCloseModal1(): void {
		(this.byId("designedNotDevDialog") as Dialog).close();
	}

	public onModal1ZoneSelect(event: IconTabBar$SelectEvent): void {
		const zone = event.getParameter("key") as string;
		const oTable = this.byId("designedNotDevTable") as Table;
		const oBinding = oTable.getBinding("items");
		if (!oBinding) return;
		if (zone === "ALL") {
			(oBinding as ReturnType<typeof oTable.getBinding>).filter([]);
		} else {
			(oBinding as ReturnType<typeof oTable.getBinding>).filter([
				new Filter("zone", FilterOperator.EQ, zone),
			]);
		}
	}

	private _rebuildModal1ZoneTabs(rows: RowData[]): void {
		const zones = this._zones(rows);
		const oTabBar = this.byId("modal1ZoneTabBar") as IconTabBar;
		oTabBar.removeAllItems();
		oTabBar.addItem(new IconTabFilter({ key: "ALL", text: `전체 (${rows.length}개)` }));
		zones.forEach(z => {
			const cnt = rows.filter(r => r.zone === z).length;
			if (cnt) oTabBar.addItem(new IconTabFilter({ key: z, text: `${z} → ${cnt}개` }));
		});
		oTabBar.setSelectedKey("ALL");
	}

	// ────────────────────────────────────────────────────────────────
	// 모달 2: 설계 미완료
	// ────────────────────────────────────────────────────────────────
	public onOpenModal2(): void {
		const all = this._getCurData()
			.filter(r => !r.designA)
			.sort(this._sortByDevPlan.bind(this));

		const todayMid = new Date(this._today);
		todayMid.setHours(0, 0, 0, 0);

		const items = all.map(r => {
			const st = formatter.getStatus(r.devPlanRaw, r.md, this._today);
			const planDate = formatter.excelDateToJS(r.designPRaw);
			let dDayTxt = "";
			if (planDate && !isNaN(planDate.getTime())) {
				const planMid = new Date(planDate);
				planMid.setHours(0, 0, 0, 0);
				if (planMid < todayMid) {
					dDayTxt = `${formatter.workdays(planMid, todayMid) - 1}일 지연`;
				} else if (planMid.getTime() === todayMid.getTime()) {
					dDayTxt = "오늘 마감";
				} else {
					dDayTxt = `D-${formatter.workdays(todayMid, planMid) - 1}`;
				}
			}
			return {
				no: r.no,
				zone: r.zone,
				zoneState: formatter.getZoneState(r.zone),
				name: r.name,
				designP: r.designP || "미정",
				devPlan: r.devPlan || "미정",
				devWho: r.devWho || r.designer || "—",
				md: r.md ? String(r.md) : "—",
				statusLbl: st.lbl,
				statusState: st.state,
				dDayTxt,
			};
		});

		const tmd = all.reduce((s, r) => s + r.md, 0);
		this._oModel.setProperty("/modal2", {
			subTitle: `설계 실적 미완료  ·  총 ${tmd} M/D  ·  설계 계획일 D-Day 표시  ·  개발 계획일 기준 정렬`,
			items,
		});

		this._rebuildModal2ZoneTabs(all);
		(this.byId("noDesignDialog") as Dialog).open();
	}

	public onCloseModal2(): void {
		(this.byId("noDesignDialog") as Dialog).close();
	}

	public onModal2ZoneSelect(event: IconTabBar$SelectEvent): void {
		const zone = event.getParameter("key") as string;
		const oTable = this.byId("noDesignTable") as Table;
		const oBinding = oTable.getBinding("items");
		if (!oBinding) return;
		if (zone === "ALL") {
			(oBinding as ReturnType<typeof oTable.getBinding>).filter([]);
		} else {
			(oBinding as ReturnType<typeof oTable.getBinding>).filter([
				new Filter("zone", FilterOperator.EQ, zone),
			]);
		}
	}

	private _rebuildModal2ZoneTabs(rows: RowData[]): void {
		const zones = this._zones(rows);
		const oTabBar = this.byId("modal2ZoneTabBar") as IconTabBar;
		oTabBar.removeAllItems();
		oTabBar.addItem(new IconTabFilter({ key: "ALL", text: `전체 (${rows.length}개)` }));
		zones.forEach(z => {
			const cnt = rows.filter(r => r.zone === z).length;
			if (cnt) oTabBar.addItem(new IconTabFilter({ key: z, text: `${z} → ${cnt}개` }));
		});
		oTabBar.setSelectedKey("ALL");
	}

	// ────────────────────────────────────────────────────────────────
	// 유틸
	// ────────────────────────────────────────────────────────────────
	private _zones(data: RowData[]): string[] {
		return [...new Set(data.map(r => r.zone))].filter(Boolean).sort();
	}

	private _sortByDevPlan(a: RowData, b: RowData): number {
		const da = formatter.excelDateToJS(a.devPlanRaw);
		const db = formatter.excelDateToJS(b.devPlanRaw);
		if (!da && !db) return 0;
		if (!da) return 1;
		if (!db) return -1;
		return da.getTime() - db.getTime();
	}

	private _setBanner(type: "Error" | "Information" | "Success", msg: string): void {
		const oStrip = this.byId("parseBanner") as MessageStrip;
		oStrip.setType(type);
		oStrip.setText(msg);
		oStrip.setVisible(true);
	}
}
