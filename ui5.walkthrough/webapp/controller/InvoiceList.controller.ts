import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import formatter from "../model/formatter";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import { SearchField$SearchEvent, SearchField$LiveChangeEvent } from "sap/m/SearchField";
import ListBinding from "sap/ui/model/ListBinding";
import { ObjectListItem$PressEvent } from "sap/m/ObjectListItem";

/**
 * @namespace ui5.walkthrough.controller
 */
export default class InvoiceList extends Controller {
	public formatter = formatter;

	public onInit(): void {
		const oViewModel = new JSONModel({
			currency: "EUR"
		});
		this.getView()?.setModel(oViewModel, "view");
	}

	public onPress(oEvent: ObjectListItem$PressEvent): void {
		const oItem = oEvent.getSource();
		const oRouter = this.getOwnerComponent()?.getRouter();
		oRouter?.navTo("detail", {
			invoicePath: window.encodeURIComponent(
				oItem.getBindingContext("invoice")?.getPath().substring(1) ?? ""
			)
		});
	}

	public onFilterInvoices(oEvent: SearchField$SearchEvent | SearchField$LiveChangeEvent): void {
		const sQuery = oEvent.getParameter("query") ?? oEvent.getParameter("newValue");
		const aFilters: Filter[] = [];

		if (sQuery) {
			aFilters.push(new Filter("ProductName", FilterOperator.Contains, sQuery));
		}

		const oList = this.byId("invoiceList");
		const oBinding = oList?.getBinding("items") as ListBinding;
		oBinding?.filter(aFilters);
	}
}
