import type {SuiteConfiguration} from "sap/ui/test/starter/config";
export default {
	name: "QUnit test suite for the UI5 Application: sap.dev.dashboard",
	defaults: {
		page: "ui5://test-resources/sap/dev/dashboard/Test.qunit.html?testsuite={suite}&test={name}",
		qunit: {
			version: 2
		},
		sinon: {
			version: 4
		},
		ui5: {
			language: "EN",
			theme: "sap_horizon"
		},
		coverage: {
			only: ["sap/dev/dashboard/"],
			never: ["test-resources/sap/dev/dashboard/"]
		},
		loader: {
			paths: {
				"sap/dev/dashboard": "../"
			}
		}
	},
	tests: {
		"unit/unitTests": {
			title: "Unit tests for sap.dev.dashboard"
		},
		"integration/opaTests": {
			title: "Integration tests for sap.dev.dashboard"
		}
	}
} satisfies SuiteConfiguration;
