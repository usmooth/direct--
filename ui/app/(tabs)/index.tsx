import { SPECIFIC_backend_url } from "@/constants";
import { Link, Stack } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Alert,
  Pressable,
  Dimensions,
} from "react-native";
import * as Progress from "react-native-progress";
import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import parsePhoneNumberFromString, {
  CountryCode,
} from "libphonenumber-js/mobile";
import * as Localization from "expo-localization";

export default function Index() {
  const [person, setPerson] = useState("");
  const [foundContact, setFoundContact] = useState<Contacts.Contact | null>(
    null
  );
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const normalizePhoneNumber = (phone: string): string | null => {
    const locales = Localization.getLocales();
    const primaryLocale = locales[0];
    const normalizedNumber = parsePhoneNumberFromString(
      phone,
      primaryLocale.regionCode as CountryCode
    );

    if (!normalizedNumber || !normalizedNumber.isValid()) {
      // User'a numarayı düzeltmesini söyle
      return null;
    }
    return normalizedNumber.number;
  };

  const sendApprovalRequest = async () => {
    if (!person.trim()) {
      Alert.alert("Input required", "Please type something before approving.");
      return;
    }

    if (!foundContact || !foundContact.phoneNumbers) {
      Alert.alert(
        "Contact not found",
        "Please select a valid contact from your list."
      );
      return;
    }

    const phoneNumber = foundContact.phoneNumbers[0].number;
    if (!phoneNumber) {
      Alert.alert(
        "No Phone Number",
        "This contact does not have a phone number."
      );
      return;
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (normalizedPhoneNumber === null) {
      Alert.alert(
        "Phone number is not valid",
        "Please edit phone number with country code and try again."
      );
      return;
    }

    try {
      const hashedPhoneNumber = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalizedPhoneNumber
      );

      const response = await fetch(`${SPECIFIC_backend_url}/send-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedbackTo: hashedPhoneNumber }),
      });

      if (response.ok) {
        console.log("Feedback sent successfully");
      } else {
        console.error("Failed to send feedback:", response.statusText);
      }
    } catch (error) {
      console.error("Failed to send approval request:", error);
      Alert.alert("Error", "Could not complete the approval request.");
    }
  };

  const handlePressIn = () => {
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(intervalRef.current!);
          setProgress(0);
          sendApprovalRequest();
          return 1;
        }
        return prev + 0.1; // 10ms * 500 steps = 5000ms = 5s
      }); // This interval is not perfectly accurate, but fine for UI purposes
    }, 50); // Update every 50ms
  };

  const handlePressOut = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress(0);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need access to your contacts to find people."
        );
      }
    })();
  }, []);

  const handleSearch = async (name: string) => {
    setPerson(name);
    setFoundContact(null); // Reset previous search result

    if (name.trim()) {
      const { data } = await Contacts.getContactsAsync({
        name,
      });

      // Find a contact with an exact, case-sensitive name match
      const exactMatch = data.find((contact) => contact.name === name);
      if (exactMatch) {
        setFoundContact(exactMatch);
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Home",
          headerShown: true,
          headerRight: () => (
            <>
              <Link href="/kvkk" style={{ padding: 10 }}>
                <Text style={{ fontSize: 24 }}>kvkk</Text>
              </Link>
              <Link href="/register" style={{ padding: 10 }}>
                <Text style={{ fontSize: 24 }}>Register</Text>
              </Link>
              <Link href="/notification" style={{ padding: 10 }}>
                <Text style={{ fontSize: 24 }}>🔔</Text>
              </Link>
            </>
          ),
        }}
      />
      <View style={styles.container}>
        <Progress.Bar
          progress={progress}
          width={Dimensions.get("window").width * 0.8}
          height={10}
          color={"#007bff"}
          style={styles.progressBar}
        />
        <TextInput
          style={styles.input}
          placeholder="Type something here..."
          onChangeText={handleSearch}
          value={person}
        />
        {foundContact && (
          <Text style={styles.contactInfo}>Found: {foundContact.name}</Text>
        )}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? "#0056b3" : "#007bff" },
          ]}
        >
          <Text style={styles.buttonText}>Hold to Approve</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: "25%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  input: {
    width: "80%",
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  progressBar: {
    marginBottom: 20,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  contactInfo: {
    marginTop: 8,
    fontSize: 16,
    color: "green",
  },
});
