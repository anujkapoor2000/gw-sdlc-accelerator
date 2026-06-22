import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.ClaimCenterActions as CC

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * CC03 — Assign an open claim to a group/user and close it with an outcome.
 *
 * Requires an open claim. Group/User must exist in your environment's org tree.
 */
String CLAIM_NUMBER = '235-53-365721'   // TODO: point at an open claim

LoginActions.loginClaimCenter()

CC.openClaim(CLAIM_NUMBER)
CC.assignClaim('Auto1 - TeamA', 'Andy Applegate')
CC.closeClaim('Settled')
WebUI.comment('Assigned and closed claim ' + CLAIM_NUMBER)

close()
