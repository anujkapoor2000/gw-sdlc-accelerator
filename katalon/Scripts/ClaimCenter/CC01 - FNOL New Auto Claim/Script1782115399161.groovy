import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.ClaimCenterActions as CC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * CC01 — File a First Notice of Loss against an in-force policy and submit a claim.
 *
 * Requires a policy that exists in ClaimCenter's policy view (synced from PC or
 * loaded as policy data). Set POLICY_NUMBER accordingly.
 */
String POLICY_NUMBER = '0000000001'   // TODO: point at a policy visible in ClaimCenter

LoginActions.loginClaimCenter()

CC.startFNOL(POLICY_NUMBER, Data.dateOffset(-1))
CC.setLossDetails('Collision', 'Rear-ended at a stop light - automated regression ' + Data.uniqueSuffix())
String claimNumber = CC.submitClaim()

WebUI.verifyMatch(claimNumber?.trim() ? 'true' : 'false', 'true', false)
WebUI.comment('Created claim: ' + claimNumber)

close()
