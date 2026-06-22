package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword

import internal.GlobalVariable

import static com.nttdata.guidewire.GuidewireUI.*

/**
 * LoginActions — authentication for each Guidewire application.
 *
 * The three back-office apps share the same login DV markup, differing only in
 * the screen-id prefix, so a single helper handles PolicyCenter, ClaimCenter
 * and BillingCenter. Jutro authenticates against the digital portal's React
 * login form.
 */
public class LoginActions {

	// Back-office login DV (PC/CC/BC use the identical OOTB Login screen widget ids).
	private static final String USER_FIELD = "//input[contains(@id,'Login-LoginScreen-LoginDV-username') or contains(@name,'username')]"
	private static final String PASS_FIELD = "//input[contains(@id,'Login-LoginScreen-LoginDV-password') or contains(@name,'password')]"
	private static final String LOGIN_BTN  = "//div[contains(@id,'Login-LoginScreen-LoginDV-submit')] | //input[@value='Login'] | //button[normalize-space()='Login']"
	// First widget on the landing/desktop page once authenticated.
	private static final String TAB_BAR    = "//div[contains(@id,'TabBar')] | //div[contains(@class,'gw-TabBar')]"

	/** Log into a back-office app at the given URL with the configured su/gw user. */
	@Keyword
	static void loginBackOffice(String url) {
		open(url)
		type(USER_FIELD, GlobalVariable.USERNAME)
		type(PASS_FIELD, GlobalVariable.PASSWORD)
		click(LOGIN_BTN)
		waitVisible(TAB_BAR)
		step('Authenticated into ' + url)
	}

	@Keyword
	static void loginPolicyCenter() {
		loginBackOffice(GlobalVariable.PC_URL)
	}

	@Keyword
	static void loginClaimCenter() {
		loginBackOffice(GlobalVariable.CC_URL)
	}

	@Keyword
	static void loginBillingCenter() {
		loginBackOffice(GlobalVariable.BC_URL)
	}

	/** Log into the Jutro self-service portal. */
	@Keyword
	static void loginJutro() {
		open(GlobalVariable.JUTRO_URL)
		type("//input[@name='username' or @type='email' or contains(@id,'username')]", GlobalVariable.JUTRO_USERNAME)
		type("//input[@name='password' or @type='password']", GlobalVariable.JUTRO_PASSWORD)
		click("//button[@type='submit' or contains(@class,'login') or normalize-space()='Sign in']")
		step('Authenticated into Jutro portal')
	}

	/** Log out of any back-office app via the OOTB user menu. */
	@Keyword
	static void logoutBackOffice() {
		click("//div[contains(@id,'LogoutLink')] | //a[normalize-space()='Log Out']")
		step('Logged out')
	}
}
