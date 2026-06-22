import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.BillingCenterActions as BC

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * BC02 — Open a billing account and verify the invoice list renders.
 */
String ACCOUNT_NUMBER = '9000000001'   // TODO: point at a billing account with invoices

LoginActions.loginBillingCenter()

BC.openAccount(ACCOUNT_NUMBER)
int invoiceCount = BC.viewInvoices()
assert invoiceCount >= 0 : 'Invoice list did not render'
WebUI.comment('Account ' + ACCOUNT_NUMBER + ' shows ' + invoiceCount + ' invoice(s)')

close()
