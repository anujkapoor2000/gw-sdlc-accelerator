import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.PolicyCenterActions as PC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * PC01 — New Personal Auto submission through quote and bind.
 *
 * Happy-path "quote & buy" for an underwriter: create a person account, start a
 * Personal Auto submission, add a vehicle and driver, quote and issue.
 */

String first = Data.firstName()
String last  = Data.lastName()

LoginActions.loginPolicyCenter()

PC.createPersonAccount(first, last, 'San Francisco')
PC.startSubmission('Personal Auto')
PC.setEffectiveDate(Data.dateOffset(1))
PC.addVehicle(Data.vin(), '2022', 'Toyota', 'Camry')
PC.addDriver(first, last, 'D' + Data.uniqueSuffix())
PC.acceptDefaultCoverages()

String premium = PC.quote()
WebUI.verifyMatch(premium?.trim() ? 'true' : 'false', 'true', false)

String policyNumber = PC.issuePolicy()
WebUI.comment('Bound PolicyCenter policy: ' + policyNumber)

close()
