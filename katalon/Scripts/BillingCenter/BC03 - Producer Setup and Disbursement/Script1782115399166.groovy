import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.BillingCenterActions as BC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * BC03 — Create a producer record, then issue a disbursement on an account.
 */
String ACCOUNT_NUMBER = '9000000001'   // TODO: point at a billing account eligible for a disbursement

LoginActions.loginBillingCenter()

String suffix = Data.uniqueSuffix()
BC.createProducer('Northwind Agency ' + suffix, 'NW' + suffix)

BC.openAccount(ACCOUNT_NUMBER)
String disb = BC.issueDisbursement(Data.amount(25, 100), 'Policy Holder')
WebUI.comment('Disbursement reference: ' + disb)

close()
