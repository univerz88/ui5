import Controller from "sap/ui/core/mvc/Controller";
import { Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ui5.walkthrough.controller
 */
export default class Detail extends Controller {
	public onInit(): void {
		const oViewModel = new JSONModel({
			currency: "EUR"
		});
		this.getView()?.setModel(oViewModel, "view");

		const oRouter = this.getOwnerComponent()?.getRouter();
		oRouter?.getRoute("detail")?.attachPatternMatched(this.onObjectMatched, this);
	}

	private onObjectMatched(oEvent: Route$PatternMatchedEvent): void {
		const sInvoicePath = window.decodeURIComponent(
			oEvent.getParameter("arguments")["invoicePath"]
		);
		this.getView()?.bindElement({
			path: "/" + sInvoicePath,
			model: "invoice"
		});
	}

	public onNavBack(): void {
		const oHistory = History.getInstance();
		const sPreviousHash = oHistory.getPreviousHash();

		if (sPreviousHash !== undefined) {
			window.history.go(-1);
		} else {
			this.getOwnerComponent()?.getRouter().navTo("overview", {}, true);
		}
	}
}
