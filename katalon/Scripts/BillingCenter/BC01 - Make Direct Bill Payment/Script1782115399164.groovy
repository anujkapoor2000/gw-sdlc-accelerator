import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.BillingCenterActions as BC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * BC01 — Take a one-time direct payment on a billing account.
 *
 * Requires a billing account with an outstanding balance.
 */
String ACCOUNT_NUMBER = '9000000001'   // TODO: point at a billing account with a balance

LoginActions.loginBillingCenter()

BC.openAccount(ACCOUNT_NUMBER)
String before = BC.accountBalance()
WebUI.comment('Balance before payment: ' + before)

String receipt = BC.makePayment(Data.amount(50, 250), 'Credit Card')
WebUI.comment('Payment confirmation: ' + receipt)

close()
