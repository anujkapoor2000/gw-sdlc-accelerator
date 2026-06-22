import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.JutroActions as JU
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * JU02 — Self-service FNOL through the Jutro portal.
 *
 * Logs in as a policyholder, opens a policy and files a claim from the portal.
 * Requires a portal account (JUTRO_USERNAME/PASSWORD) with at least one policy.
 */

LoginActions.loginJutro()

JU.openMyPolicy()
String claimRef = JU.selfServiceFNOL(Data.dateOffset(-2), 'Windshield cracked on the freeway - automated regression ' + Data.uniqueSuffix())

WebUI.verifyMatch(claimRef?.trim() ? 'true' : 'false', 'true', false)
WebUI.comment('Self-service claim filed: ' + claimRef)

close()
