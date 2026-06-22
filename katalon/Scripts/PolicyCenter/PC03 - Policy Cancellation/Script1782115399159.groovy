import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.PolicyCenterActions as PC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * PC03 — Cancel an in-force policy and confirm the cancelled status.
 *
 * Requires a staged in-force policy. Use a policy you are happy to cancel in the
 * target environment.
 */
String POLICY_NUMBER = '0000000001'   // TODO: point at a staged in-force policy

LoginActions.loginPolicyCenter()

PC.openPolicy(POLICY_NUMBER)
PC.cancelPolicy('Insured Request', Data.dateOffset(7))

verifyTextPresent('Cancel')
WebUI.comment('Cancellation submitted for policy ' + POLICY_NUMBER)

close()
