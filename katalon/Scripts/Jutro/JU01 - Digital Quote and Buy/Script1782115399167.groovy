import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.JutroActions as JU
import com.nttdata.guidewire.TestData as Data

import internal.GlobalVariable

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * JU01 — Jutro digital quote-and-buy, end to end.
 *
 * Drives the React-based digital experience: personal info, vehicle, coverage
 * selection, quote, payment and bind. data-test ids live in JutroActions.
 */

String first = Data.firstName()
String last  = Data.lastName()

open(GlobalVariable.JUTRO_URL)

JU.startQuoteAndBuy()
JU.fillPersonalInfo(first, last, Data.email(first, last), '01/15/1990')
JU.addVehicle('2022', 'Tesla', 'Model 3', Data.vin())
JU.selectCoveragePackage('Standard')

String premium = JU.readQuotePremium()
WebUI.verifyMatch(premium?.trim() ? 'true' : 'false', 'true', false)

String confirmation = JU.payAndBind('4111111111111111', '12/30', '123')
WebUI.comment('Digital purchase confirmed: ' + confirmation)

close()
