package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword

import static com.nttdata.guidewire.GuidewireUI.*

/**
 * JutroActions — common Jutro digital-experience flows.
 *
 * Jutro is Guidewire's React-based design system / digital framework. Unlike the
 * legacy back-office apps, its components are best located by the
 * `data-test` attribute Jutro emits on every field, so these helpers lean on
 * {@link GuidewireUI#byTestId}. Covers the headline digital journeys: a
 * quote-and-buy flow and a self-service account / FNOL flow.
 *
 * data-test ids below mirror the Jutro QuoteAndBind / DigitalEngage reference
 * apps. Replace them with your project's ids if the digital team has renamed
 * the components.
 */
public class JutroActions {

	private static final String NEXT = "[data-test='wizard-next'], [data-test='next-button'], button[type='submit']"

	private static void clickCss(String css) {
		def to = byCss(css)
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.waitForElementClickable(to, 30)
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.click(to)
	}

	private static void typeTest(String dataTest, String value) {
		def to = byTestId(dataTest)
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.waitForElementVisible(to, 30)
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.setText(to, value)
	}

	/** Land on the Jutro quote-and-buy entry point and start a new quote. */
	@Keyword
	static void startQuoteAndBuy() {
		clickCss("[data-test='start-quote'], [data-test='get-a-quote']")
		step('Started Jutro quote-and-buy')
	}

	/** Fill the applicant's personal information page. */
	@Keyword
	static void fillPersonalInfo(String firstName, String lastName, String email, String dob) {
		typeTest('firstName', firstName)
		typeTest('lastName', lastName)
		typeTest('emailAddress1', email)
		typeTest('dateOfBirth', dob)
		clickCss(NEXT)
		step('Filled personal info for ' + firstName + ' ' + lastName)
	}

	/** Add a vehicle to the digital quote. */
	@Keyword
	static void addVehicle(String year, String make, String model, String vin) {
		clickCss("[data-test='add-vehicle']")
		typeTest('year', year)
		typeTest('make', make)
		typeTest('model', model)
		typeTest('vin', vin)
		clickCss(NEXT)
		step('Added vehicle ' + year + ' ' + make + ' ' + model)
	}

	/** Choose a coverage package by its label and continue. */
	@Keyword
	static void selectCoveragePackage(String packageLabel) {
		clickCss("[data-test='coverage-" + packageLabel.toLowerCase() + "'], [aria-label='" + packageLabel + "']")
		clickCss(NEXT)
		step('Selected coverage package: ' + packageLabel)
	}

	/** Read the quoted premium from the quote summary card. */
	@Keyword
	static String readQuotePremium() {
		def to = byTestId('total-premium')
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.waitForElementVisible(to, 30)
		String premium = com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.getText(to)
		step('Digital quote premium = ' + premium)
		return premium
	}

	/** Complete payment and bind the digital quote; returns confirmation text. */
	@Keyword
	static String payAndBind(String cardNumber, String expiry, String cvv) {
		clickCss("[data-test='buy-now'], [data-test='proceed-to-payment']")
		typeTest('cardNumber', cardNumber)
		typeTest('expiryDate', expiry)
		typeTest('cvv', cvv)
		clickCss("[data-test='submit-payment'], [data-test='confirm-purchase']")
		def conf = byTestId('confirmation-message')
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.waitForElementVisible(conf, 30)
		String msg = com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.getText(conf)
		step('Bound digital policy: ' + msg)
		return msg
	}

	/** From the self-service dashboard, open the first active policy. */
	@Keyword
	static void openMyPolicy() {
		clickCss("[data-test='policies-tab'], a[href*='policies']")
		clickCss("[data-test='policy-card']:first-child, [data-test='view-policy']")
		step('Opened self-service policy')
	}

	/** Start a self-service FNOL from the digital portal and return the claim ref. */
	@Keyword
	static String selfServiceFNOL(String lossDate, String description) {
		clickCss("[data-test='report-claim'], [data-test='file-a-claim']")
		typeTest('lossDate', lossDate)
		typeTest('lossDescription', description)
		clickCss("[data-test='submit-claim'], " + NEXT)
		def ref = byTestId('claim-reference')
		com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.waitForElementVisible(ref, 30)
		String claimRef = com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords.getText(ref)
		step('Filed self-service claim ' + claimRef)
		return claimRef
	}
}
