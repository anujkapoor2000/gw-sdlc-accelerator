package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.util.KeywordUtil
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

import org.openqa.selenium.Keys

import internal.GlobalVariable

/**
 * GuidewireUI — the shared, locator-agnostic interaction layer for every
 * Guidewire flow library in this project.
 *
 * Guidewire's legacy web UIs (PolicyCenter / ClaimCenter / BillingCenter) render
 * widgets with deterministic, ID-driven markup (e.g. an input whose @name is
 * "NewSubmission:NewSubmissionScreen:..."). Jutro renders React components that
 * are best located by data-test attributes. Rather than commit hundreds of
 * static Object Repository entries that drift every release, these libraries
 * build {@link TestObject}s on the fly from a selector string. This keeps the
 * flow scripts readable and the locators in one auditable place per product.
 *
 * Call from a test case with:  import static com.nttdata.guidewire.GuidewireUI.*
 */
public class GuidewireUI {

	/** Build a TestObject from a raw XPath. */
	@Keyword
	static TestObject byXpath(String xpath) {
		TestObject to = new TestObject(xpath)
		to.addProperty('xpath', ConditionType.EQUALS, xpath)
		return to
	}

	/** Build a TestObject from a CSS selector (Jutro / digital screens). */
	@Keyword
	static TestObject byCss(String css) {
		TestObject to = new TestObject(css)
		to.addProperty('css', ConditionType.EQUALS, css)
		return to
	}

	/** Build a TestObject for a Jutro element by its data-test attribute. */
	@Keyword
	static TestObject byTestId(String dataTest) {
		return byCss("[data-test='" + dataTest + "']")
	}

	private static int timeout() {
		return (GlobalVariable.TIMEOUT ?: 30) as int
	}

	/** Open a URL in a maximised browser and wait for the page to settle. */
	@Keyword
	static void open(String url) {
		WebUI.openBrowser('')
		WebUI.maximizeWindow()
		WebUI.navigateToUrl(url)
		WebUI.waitForPageLoad(timeout())
	}

	@Keyword
	static void waitVisible(String xpath) {
		WebUI.waitForElementVisible(byXpath(xpath), timeout())
	}

	@Keyword
	static void waitClickable(String xpath) {
		WebUI.waitForElementClickable(byXpath(xpath), timeout())
	}

	/** Wait for the widget, then click it. Works for buttons, links and menu rows. */
	@Keyword
	static void click(String xpath) {
		TestObject to = byXpath(xpath)
		WebUI.waitForElementClickable(to, timeout())
		WebUI.click(to)
	}

	/** Clear and type into a text field. */
	@Keyword
	static void type(String xpath, String value) {
		TestObject to = byXpath(xpath)
		WebUI.waitForElementVisible(to, timeout())
		WebUI.clearText(to)
		WebUI.setText(to, value)
	}

	/** Select an option from a Guidewire dropdown (a real <select>) by visible label. */
	@Keyword
	static void selectByLabel(String xpath, String label) {
		TestObject to = byXpath(xpath)
		WebUI.waitForElementVisible(to, timeout())
		WebUI.selectOptionByLabel(to, label, false)
	}

	/** Set a Guidewire date field (mm/dd/yyyy) and commit it with TAB so the page posts back. */
	@Keyword
	static void typeDate(String xpath, String mmddyyyy) {
		type(xpath, mmddyyyy)
		WebUI.sendKeys(byXpath(xpath), Keys.chord(Keys.TAB))
		WebUI.waitForPageLoad(timeout())
	}

	@Keyword
	static String text(String xpath) {
		TestObject to = byXpath(xpath)
		WebUI.waitForElementVisible(to, timeout())
		return WebUI.getText(to)
	}

	@Keyword
	static boolean present(String xpath) {
		return WebUI.verifyElementPresent(byXpath(xpath), 5, com.kms.katalon.core.model.FailureHandling.OPTIONAL)
	}

	@Keyword
	static void verifyTextPresent(String expected) {
		WebUI.verifyTextPresent(expected, false)
	}

	/** Mark a named business milestone in the log and optionally screenshot it. */
	@Keyword
	static void step(String label) {
		KeywordUtil.logInfo('STEP: ' + label)
		if (GlobalVariable.SCREENSHOT_EACH_STEP) {
			WebUI.takeScreenshot()
		}
	}

	@Keyword
	static void close() {
		WebUI.closeBrowser()
	}
}
