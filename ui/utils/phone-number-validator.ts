import parsePhoneNumberFromString from "libphonenumber-js/mobile";

export const validatePhoneNumber = (phone: string): string | null => {
	if (!phone) return null;

	try {
		const phoneNumber = parsePhoneNumberFromString(phone);

		if (phoneNumber?.isValid()) {
			return phoneNumber.format("E.164");
		}
	} catch (error) {
		console.error("Phone number validation error:", error);
	}

	return null;
};
