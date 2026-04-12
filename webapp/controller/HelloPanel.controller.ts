import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";

/**
 * @namespace ui5.walkthrough.controller
 */
export default class HelloPanel extends Controller {
	private _oDialog?: Dialog;

	public async onShowHello(): Promise<void> {
		const oBundle = await (this.getView()?.getModel("i18n") as ResourceModel)
			.getResourceBundle() as ResourceBundle;
		const sRecipient = (this.getView()?.getModel() as JSONModel)
			.getProperty("/recipient/name") as string;
		const sMsg = oBundle.getText("helloMsg", [sRecipient]);

		MessageToast.show(sMsg);
	}

	public onCloseDialog(): void {
		this._oDialog?.close();
	}

	public async onOpenDialog(): Promise<void> {
		if (!this._oDialog) {
			const oView = this.getView();
			this._oDialog = await Fragment.load({
				id: oView?.getId(),
				name: "ui5.walkthrough.view.HelloDialog",
				controller: this
			}) as Dialog;
			oView?.addDependent(this._oDialog);
		}
		this._oDialog.open();
	}
}
