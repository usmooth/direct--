import * as Localization from "expo-localization";
import parsePhoneNumberFromString, {
  CountryCode,
} from "libphonenumber-js/mobile";

export const normalizePhoneNumber = (phone: string): string | null => {
	if (!phone) return null;
	let cleaned = phone.replace(/[^\d+]/g, "");

	if (cleaned.startsWith("00")) {
		cleaned = "+" + cleaned.substring(2);
	}

	const locales = Localization.getLocales();
	const deviceRegion = "TR" as CountryCode;

	try {
		const phoneNumber = parsePhoneNumberFromString(cleaned, deviceRegion);

		if (phoneNumber && phoneNumber.isValid()) {
			return phoneNumber.format("E.164");
		}
	} catch (error) {
		console.error("Phone normalization error:", error);
	}

	return null;
};
