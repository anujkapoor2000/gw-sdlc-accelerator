package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

import static com.nttdata.guidewire.GuidewireUI.*

/**
 * PolicyCenterActions — common PolicyCenter underwriting flows.
 *
 * Covers the everyday transactions a PC test pack needs: account creation, a
 * new Personal Auto submission through quote and bind, mid-term policy change
 * (endorsement), cancellation and renewal.
 *
 * Locators target OOTB widget ids. Guidewire ids are stable within a release
 * but customers customise the screens, so each xpath is written defensively
 * (id-prefix contains() plus a label/text fallback). Verify against your own
 * environment and adjust the constants below — that is the single place to
 * change when the config team renames a step.
 */
public class PolicyCenterActions {

	// ---- shared chrome -------------------------------------------------------
	private static final String CONTINUE  = "//div[contains(@id,'-Continue')]//*[normalize-space()='Next'] | //input[@value='Next'] | //div[contains(@id,'Wizard-WizardButtonBar-next')]"
	private static final String QUOTE_BTN = "//div[contains(@id,'-Quote')] | //input[@value='Quote'] | //*[normalize-space()='Quote' and (self::input or self::button or self::div)]"
	private static final String ISSUE_BTN = "//div[contains(@id,'-Issue')] | //input[@value='Issue Policy'] | //*[normalize-space()='Issue Policy']"

	/**
	 * Create a new person Account from the top "Account" menu and return to the
	 * account file. Returns nothing; the new account becomes the active context.
	 */
	@Keyword
	static void createPersonAccount(String firstName, String lastName, String city) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Account'] | //a[normalize-space()='Account']")
		click("//*[normalize-space()='New Account']")
		type("//input[contains(@id,'AccountSearchDV-Keyword')]", lastName)
		click("//div[contains(@id,'AccountSearchDV-SearchAndResetInputSet-Search')] | //input[@value='Search']")
		step('Searched existing accounts for ' + lastName)
		// No match -> create a brand new Person account
		click("//*[normalize-space()='Create New Account'] | //div[contains(@id,'CreateNewAccountMenuItem')]")
		click("//*[normalize-space()='Person']")
		type("//input[contains(@id,'GlobalPersonInfoInputSet-FirstName')]", firstName)
		type("//input[contains(@id,'GlobalPersonInfoInputSet-LastName')]", lastName)
		type("//input[contains(@id,'-City')]", city)
		selectByLabel("//select[contains(@id,'-State')]", 'California')
		click("//input[@value='Update'] | //*[normalize-space()='Update']")
		step('Created person account ' + firstName + ' ' + lastName)
	}

	/** Start a new submission for the named line on the active account. */
	@Keyword
	static void startSubmission(String lineOfBusiness) {
		click("//*[normalize-space()='Actions'] | //div[contains(@id,'AccountFile-AccountFileMenuActions')]")
		click("//*[normalize-space()='New Submission']")
		click("//div[contains(@id,'NewSubmission')]//*[normalize-space()='" + lineOfBusiness + "'] | //*[normalize-space()='" + lineOfBusiness + "']")
		click(CONTINUE)
		step('Started ' + lineOfBusiness + ' submission')
	}

	/** Fill the policy-level start screen (effective date) and advance. */
	@Keyword
	static void setEffectiveDate(String mmddyyyy) {
		typeDate("//input[contains(@id,'-PeriodStartDate')]", mmddyyyy)
		click(CONTINUE)
		step('Set effective date ' + mmddyyyy)
	}

	/** Add a vehicle on the Personal Auto Vehicles screen. */
	@Keyword
	static void addVehicle(String vin, String year, String make, String model) {
		click("//div[contains(@id,'VehiclesLV')]//*[normalize-space()='Add'] | //*[normalize-space()='Add Vehicle']")
		type("//input[contains(@id,'-Vin')]", vin)
		type("//input[contains(@id,'-Year')]", year)
		type("//input[contains(@id,'-Make')]", make)
		type("//input[contains(@id,'-Model')]", model)
		click("//input[@value='Update'] | //*[normalize-space()='Update']")
		click(CONTINUE)
		step('Added vehicle ' + year + ' ' + make + ' ' + model)
	}

	/** Add a driver and advance off the Drivers screen. */
	@Keyword
	static void addDriver(String firstName, String lastName, String licenseNumber) {
		click("//div[contains(@id,'DriversLV')]//*[normalize-space()='Add'] | //*[normalize-space()='Add Driver']")
		type("//input[contains(@id,'-FirstName')]", firstName)
		type("//input[contains(@id,'-LastName')]", lastName)
		type("//input[contains(@id,'-LicenseNumber')]", licenseNumber)
		click("//input[@value='Update'] | //*[normalize-space()='Update']")
		click(CONTINUE)
		step('Added driver ' + firstName + ' ' + lastName)
	}

	/** Accept the default coverages and advance off the Coverages screen. */
	@Keyword
	static void acceptDefaultCoverages() {
		waitVisible("//*[contains(text(),'Coverages')]")
		click(CONTINUE)
		step('Accepted default coverages')
	}

	/**
	 * Quote the submission and return the displayed total premium text.
	 * Asserts the policy reached a quoted state.
	 */
	@Keyword
	static String quote() {
		click(QUOTE_BTN)
		waitVisible("//*[contains(@id,'-TotalPremium')] | //*[contains(text(),'Total Premium')]")
		String premium = text("//span[contains(@id,'-TotalPremium')] | //*[contains(text(),'Total Premium')]/following::span[1]")
		verifyTextPresent('Total')
		step('Quoted submission, premium = ' + premium)
		return premium
	}

	/**
	 * Issue (bind) the quoted submission and return the bound policy number.
	 */
	@Keyword
	static String issuePolicy() {
		click(ISSUE_BTN)
		// OOTB confirmation popup
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		waitVisible("//*[contains(@id,'PolicyNumber') or contains(text(),'Policy #')]")
		String policyNumber = text("//span[contains(@id,'PolicyNumber')] | //*[contains(text(),'Policy #')]/following::span[1]")
		step('Issued policy ' + policyNumber)
		return policyNumber
	}

	/** Open an in-force policy by number from the top Policy search. */
	@Keyword
	static void openPolicy(String policyNumber) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Policy'] | //a[normalize-space()='Policy']")
		type("//input[contains(@id,'PolicyNumberSearchDV-PolicyNumber')]", policyNumber)
		click("//input[@value='Search'] | //div[contains(@id,'PolicySearch')]//*[normalize-space()='Search']")
		click("//a[contains(text(),'" + policyNumber + "')]")
		waitVisible("//*[contains(text(),'Summary')]")
		step('Opened policy ' + policyNumber)
	}

	/** Start a mid-term policy change (endorsement) on the open policy. */
	@Keyword
	static void startPolicyChange(String description) {
		click("//*[normalize-space()='Actions'] | //div[contains(@id,'PolicyFile-PolicyFileMenuActions')]")
		click("//*[normalize-space()='Change Policy' or normalize-space()='Policy Change']")
		type("//input[contains(@id,'-Description')]", description)
		click(CONTINUE)
		step('Started policy change: ' + description)
	}

	/** Bind the open policy change and return the confirmation text. */
	@Keyword
	static String bindPolicyChange() {
		click("//div[contains(@id,'-Bind')] | //input[@value='Bind Options'] | //*[normalize-space()='Bind Options']")
		click("//*[normalize-space()='Finish Policy Transaction' or normalize-space()='Issue Change']")
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		step('Bound policy change')
		return text("//*[contains(text(),'effective')] | //*[contains(@id,'-EffectiveDate')]")
	}

	/** Cancel the open policy for the given reason. */
	@Keyword
	static void cancelPolicy(String reason, String cancelDate) {
		click("//*[normalize-space()='Actions']")
		click("//*[normalize-space()='Cancel Policy' or normalize-space()='Cancel']")
		selectByLabel("//select[contains(@id,'-CancelReason')]", reason)
		typeDate("//input[contains(@id,'-CancelDate' )]", cancelDate)
		click(CONTINUE)
		click("//div[contains(@id,'-Bind')] | //*[normalize-space()='Bind Options']")
		click("//*[normalize-space()='Finish Policy Transaction' or normalize-space()='Cancel Policy']")
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		step('Cancelled policy for reason: ' + reason)
	}

	/** Start a renewal on the open policy and quote it. */
	@Keyword
	static String startAndQuoteRenewal() {
		click("//*[normalize-space()='Actions']")
		click("//*[normalize-space()='Renew' or normalize-space()='Renew Policy']")
		click(CONTINUE)
		return quote()
	}
}
