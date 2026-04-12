import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ui5.walkthrough
 */
export default class Component extends UIComponent {
	public static metadata = {
		manifest: "json",
		interfaces: ["sap.ui.core.IAsyncContentCreation"]
	};

	public init(): void {
		// call the base component's init function
		super.init();

		// set data model
		const oModel = new JSONModel({
			recipient: {
				name: "World"
			}
		});
		this.setModel(oModel);
	}
}
