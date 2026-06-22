import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.ClaimCenterActions as CC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * CC02 — On an open claim, set a reserve and issue a check payment against it.
 *
 * Requires an open claim. Set CLAIM_NUMBER to one in your environment (e.g. the
 * claim CC01 produced).
 */
String CLAIM_NUMBER = '235-53-365721'   // TODO: point at an open claim

LoginActions.loginClaimCenter()

CC.openClaim(CLAIM_NUMBER)
CC.setReserve('Vehicle Repair', Data.amount(1500, 5000))
String check = CC.issuePayment('Bay Area Auto Body', Data.amount(500, 1500))
WebUI.comment('Issued check ' + check + ' on claim ' + CLAIM_NUMBER)

close()
