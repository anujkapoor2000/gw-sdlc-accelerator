package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword

import static com.nttdata.guidewire.GuidewireUI.*

/**
 * ClaimCenterActions — common ClaimCenter handling flows.
 *
 * Covers the FNOL wizard through claim creation, then the everyday adjuster
 * actions: setting reserves, issuing a payment, assigning the claim and closing
 * it. Locators follow the OOTB FNOL / Claim screen widget ids; see
 * PolicyCenterActions for the locator-strategy rationale.
 */
public class ClaimCenterActions {

	private static final String NEXT   = "//div[contains(@id,'Wizard-WizardButtonBar-next')] | //input[@value='Next'] | //*[normalize-space()='Next']"
	private static final String FINISH = "//div[contains(@id,'Wizard-WizardButtonBar-finish')] | //input[@value='Finish'] | //*[normalize-space()='Finish']"

	/**
	 * Start a First Notice of Loss against an existing policy number.
	 * Begins on the ClaimCenter desktop.
	 */
	@Keyword
	static void startFNOL(String policyNumber, String lossDate) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Claim'] | //a[normalize-space()='Claim']")
		click("//*[normalize-space()='New Claim']")
		type("//input[contains(@id,'FNOLWizard-FNOLWizard_PolicySearchScreen')]//descendant::input | //input[contains(@id,'-PolicyNumber')]", policyNumber)
		typeDate("//input[contains(@id,'-LossDate')]", lossDate)
		click("//input[@value='Search'] | //*[normalize-space()='Search']")
		click("//a[contains(text(),'" + policyNumber + "')] | //input[@value='Select']")
		click(NEXT)
		step('Started FNOL on policy ' + policyNumber)
	}

	/** Set the loss type / cause on the FNOL loss-details screen. */
	@Keyword
	static void setLossDetails(String lossCause, String description) {
		selectByLabel("//select[contains(@id,'-LossCause')]", lossCause)
		type("//textarea[contains(@id,'-Description')] | //textarea[contains(@id,'-LossDescription')]", description)
		click(NEXT)
		step('Set loss details: ' + lossCause)
	}

	/**
	 * Finish the FNOL wizard, submit the claim and return the new claim number.
	 */
	@Keyword
	static String submitClaim() {
		click(FINISH)
		waitVisible("//*[contains(@id,'ClaimNumber') or contains(text(),'Claim #')]")
		String claimNumber = text("//span[contains(@id,'ClaimNumber')] | //*[contains(text(),'Claim #')]/following::span[1]")
		step('Submitted claim ' + claimNumber)
		return claimNumber
	}

	/** Open an existing claim by number. */
	@Keyword
	static void openClaim(String claimNumber) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Claim'] | //a[normalize-space()='Claim']")
		type("//input[contains(@id,'ClaimSearch')]//descendant::input | //input[contains(@id,'-ClaimNumber')]", claimNumber)
		click("//input[@value='Search'] | //*[normalize-space()='Search']")
		click("//a[contains(text(),'" + claimNumber + "')]")
		waitVisible("//*[contains(text(),'Summary')]")
		step('Opened claim ' + claimNumber)
	}

	/** Add a reserve line on the open claim (Financials -> Reserves). */
	@Keyword
	static void setReserve(String reserveLine, String amount) {
		click("//*[normalize-space()='Financials'] | //div[contains(@id,'ClaimFinancials')]")
		click("//*[normalize-space()='New Reserve' or normalize-space()='Add Reserve']")
		selectByLabel("//select[contains(@id,'-CostType') or contains(@id,'-ReserveLine')]", reserveLine)
		type("//input[contains(@id,'-Amount')]", amount)
		click("//input[@value='OK'] | //*[normalize-space()='OK']")
		step('Set reserve ' + amount + ' on ' + reserveLine)
	}

	/** Issue a check payment against an existing reserve. */
	@Keyword
	static String issuePayment(String payee, String amount) {
		click("//*[normalize-space()='Financials']")
		click("//*[normalize-space()='New Check' or normalize-space()='New Payment']")
		type("//input[contains(@id,'-PayTo') or contains(@id,'-Payee')]", payee)
		type("//input[contains(@id,'-Amount')]", amount)
		click("//*[normalize-space()='Next'] | //input[@value='Next']")
		click("//*[normalize-space()='Submit' or normalize-space()='Finish'] | //input[@value='Submit']")
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		step('Issued payment ' + amount + ' to ' + payee)
		return text("//*[contains(@id,'-CheckNumber')] | //*[contains(text(),'Check #')]/following::span[1]")
	}

	/** Assign the open claim to a group/user via the Assign action. */
	@Keyword
	static void assignClaim(String group, String user) {
		click("//*[normalize-space()='Actions'] | //div[contains(@id,'ClaimMenuActions')]")
		click("//*[normalize-space()='Assign' or normalize-space()='Assign Claim']")
		selectByLabel("//select[contains(@id,'-Group')]", group)
		selectByLabel("//select[contains(@id,'-User')]", user)
		click("//input[@value='Assign'] | //*[normalize-space()='Assign']")
		step('Assigned claim to ' + group + ' / ' + user)
	}

	/** Close the open claim with an outcome. */
	@Keyword
	static void closeClaim(String outcome) {
		click("//*[normalize-space()='Actions']")
		click("//*[normalize-space()='Close' or normalize-space()='Close Claim']")
		selectByLabel("//select[contains(@id,'-CloseOutcome') or contains(@id,'-Resolution')]", outcome)
		click("//input[@value='OK'] | //*[normalize-space()='OK']")
		verifyTextPresent('Closed')
		step('Closed claim with outcome: ' + outcome)
	}
}
