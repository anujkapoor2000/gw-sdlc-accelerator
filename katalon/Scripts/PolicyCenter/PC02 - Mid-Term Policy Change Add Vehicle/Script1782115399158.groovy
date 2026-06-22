import static com.nttdata.guidewire.GuidewireUI.*

import com.nttdata.guidewire.LoginActions
import com.nttdata.guidewire.PolicyCenterActions as PC
import com.nttdata.guidewire.TestData as Data

import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

/**
 * PC02 — Mid-term policy change (endorsement): add a vehicle to an in-force PA policy.
 *
 * Requires a staged in-force Personal Auto policy. Set POLICY_NUMBER to one from
 * your environment, or chain PC01 ahead of this via "Add test case" in the suite
 * and pass the bound number through a test-suite variable.
 */
String POLICY_NUMBER = '0000000001'   // TODO: point at a staged in-force PA policy

LoginActions.loginPolicyCenter()

PC.openPolicy(POLICY_NUMBER)
PC.startPolicyChange('Add vehicle - automated regression ' + Data.uniqueSuffix())
PC.addVehicle(Data.vin(), '2023', 'Honda', 'CR-V')
PC.acceptDefaultCoverages()
PC.quote()
String result = PC.bindPolicyChange()
WebUI.comment('Endorsement bound: ' + result)

close()
