package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword

import static com.nttdata.guidewire.GuidewireUI.*

/**
 * BillingCenterActions — common BillingCenter flows.
 *
 * Covers account lookup, taking a direct-bill payment, reviewing invoices,
 * setting up a producer and issuing a disbursement. Locators follow the OOTB
 * BillingCenter widget ids; see PolicyCenterActions for the locator strategy.
 */
public class BillingCenterActions {

	/** Open a billing account by account number. */
	@Keyword
	static void openAccount(String accountNumber) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Account'] | //a[normalize-space()='Account']")
		type("//input[contains(@id,'AccountSearch')]//descendant::input | //input[contains(@id,'-AccountNumber')]", accountNumber)
		click("//input[@value='Search'] | //*[normalize-space()='Search']")
		click("//a[contains(text(),'" + accountNumber + "')]")
		waitVisible("//*[contains(text(),'Summary')]")
		step('Opened billing account ' + accountNumber)
	}

	/** Read the current account balance text from the account summary. */
	@Keyword
	static String accountBalance() {
		return text("//*[contains(@id,'-Balance')] | //*[contains(text(),'Balance')]/following::span[1]")
	}

	/**
	 * Take a one-time direct payment on the open account and return the
	 * confirmation/receipt text.
	 */
	@Keyword
	static String makePayment(String amount, String paymentMethod) {
		click("//*[normalize-space()='Actions'] | //div[contains(@id,'AccountMenuActions')]")
		click("//*[normalize-space()='Make Payment' or normalize-space()='New Direct Payment']")
		selectByLabel("//select[contains(@id,'-PaymentInstrument') or contains(@id,'-PaymentMethod')]", paymentMethod)
		type("//input[contains(@id,'-Amount')]", amount)
		click("//input[@value='Execute Payment'] | //*[normalize-space()='Execute Payment' or normalize-space()='Make Payment']")
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		step('Made payment of ' + amount + ' via ' + paymentMethod)
		return text("//*[contains(text(),'Payment')] | //*[contains(@id,'-PaymentConfirmation')]")
	}

	/** Open the Invoices tab on the account and return the count of invoice rows. */
	@Keyword
	static int viewInvoices() {
		click("//*[normalize-space()='Invoices'] | //div[contains(@id,'AccountInvoices')]")
		waitVisible("//table[contains(@id,'InvoicesLV')] | //*[contains(text(),'Invoice')]")
		def rows = com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords
			.findWebElements(byXpath("//table[contains(@id,'InvoicesLV')]//tr[contains(@id,'InvoicesLV-')]"), 10)
		step('Account has ' + rows.size() + ' invoice(s)')
		return rows.size()
	}

	/** Create a producer (agency) record from the Producer menu. */
	@Keyword
	static void createProducer(String producerName, String code) {
		click("//div[contains(@id,'TabBar')]//*[normalize-space()='Producer'] | //a[normalize-space()='Producer']")
		click("//*[normalize-space()='New Producer']")
		type("//input[contains(@id,'-Name')]", producerName)
		type("//input[contains(@id,'-ProducerCode' )]", code)
		click("//input[@value='Update'] | //*[normalize-space()='Update']")
		step('Created producer ' + producerName + ' (' + code + ')')
	}

	/** Issue a disbursement (refund) on the open account. */
	@Keyword
	static String issueDisbursement(String amount, String payTo) {
		click("//*[normalize-space()='Actions']")
		click("//*[normalize-space()='New Disbursement' or normalize-space()='Disbursement']")
		type("//input[contains(@id,'-PayTo') or contains(@id,'-Payee')]", payTo)
		type("//input[contains(@id,'-Amount')]", amount)
		click("//input[@value='Execute'] | //*[normalize-space()='Execute' or normalize-space()='OK']")
		if (present("//*[normalize-space()='OK']")) {
			click("//*[normalize-space()='OK']")
		}
		step('Issued disbursement ' + amount + ' to ' + payTo)
		return text("//*[contains(@id,'-CheckNumber')] | //*[contains(text(),'Disbursement')]")
	}
}
