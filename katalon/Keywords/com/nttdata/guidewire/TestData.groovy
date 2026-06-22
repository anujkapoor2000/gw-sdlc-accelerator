package com.nttdata.guidewire

import com.kms.katalon.core.annotation.Keyword
import java.text.SimpleDateFormat

/**
 * TestData — deterministic-enough random data so reruns don't collide.
 *
 * Guidewire flows fail loudly on duplicate accounts, VINs and policy numbers, so
 * every generator embeds a timestamp/random segment. Dates are returned in the
 * mm/dd/yyyy format the OOTB UI expects.
 */
public class TestData {

	private static final Random RND = new Random()

	@Keyword
	static String uniqueSuffix() {
		return new SimpleDateFormat('HHmmssSSS').format(new Date())
	}

	@Keyword
	static String firstName() {
		def names = ['Avery', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Quinn', 'Taylor', 'Reese']
		return names[RND.nextInt(names.size())]
	}

	@Keyword
	static String lastName() {
		return 'Tester' + uniqueSuffix()
	}

	@Keyword
	static String companyName() {
		return 'Acme Logistics ' + uniqueSuffix() + ' LLC'
	}

	@Keyword
	static String email(String first, String last) {
		return (first + '.' + last + '@example.com').toLowerCase()
	}

	@Keyword
	static String phone() {
		return String.format('415555%04d', RND.nextInt(10000))
	}

	/** A syntactically valid 17-char VIN (no I/O/Q, as the real spec requires). */
	@Keyword
	static String vin() {
		def chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
		def sb = new StringBuilder('1HGCM')
		(0..<12).each { sb.append(chars.charAt(RND.nextInt(chars.length()))) }
		return sb.toString()
	}

	@Keyword
	static String licensePlate() {
		return 'GW' + uniqueSuffix()[-5..-1]
	}

	@Keyword
	static String today() {
		return new SimpleDateFormat('MM/dd/yyyy').format(new Date())
	}

	/** A date offset by the given number of days from today, mm/dd/yyyy. */
	@Keyword
	static String dateOffset(int days) {
		Calendar c = Calendar.getInstance()
		c.add(Calendar.DAY_OF_MONTH, days)
		return new SimpleDateFormat('MM/dd/yyyy').format(c.getTime())
	}

	@Keyword
	static String amount(int min, int max) {
		return String.valueOf(min + RND.nextInt(max - min + 1))
	}
}
