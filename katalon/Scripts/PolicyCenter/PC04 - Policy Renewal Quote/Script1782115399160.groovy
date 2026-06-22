import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.PolicyCenterActions as PC

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * PC04 — Start a renewal on an in-force policy and confirm it quotes.
 *
 * Requires a staged policy near its renewal window.
 */
String POLICY_NUMBER = '0000000001'   // TODO: point at a renewable in-force policy

LoginActions.loginPolicyCenter()

PC.openPolicy(POLICY_NUMBER)
String premium = PC.startAndQuoteRenewal()
WebUI.verifyMatch(premium?.trim() ? 'true' : 'false', 'true', false)
WebUI.comment('Renewal quoted for ' + POLICY_NUMBER + ' at ' + premium)

close()
