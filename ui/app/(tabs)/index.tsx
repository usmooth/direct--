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
} from "react-native";
import * as Contacts from "expo-contacts";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { validatePhoneNumber } from "@/utils/phone-number-validator";

export default function Index() {
  const [person, setPerson] = useState("");
  const [foundContact, setFoundContact] = useState<Contacts.Contact | null>(null);
  const [progress, setProgress] = useState(0);
  const [buttonColor, setButtonColor] = useState("transparent");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Generates random matte colors for the button fill
  const getRandomMatteColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 60%, 65%)`;
  };

  const handleSearch = async (name: string) => {
    setPerson(name);
    setFoundContact(null);

    if (name.trim()) {
      const { data } = await Contacts.getContactsAsync({
        name,
      });

      const exactMatch = data.find((contact) => contact.name === name);
      if (exactMatch) {
        setFoundContact(exactMatch);
      }
    }
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

    const contactNumbers = foundContact.phoneNumbers;
    const bestNumber =
      contactNumbers.find((p) => p.label === "mobile") || contactNumbers[0];
    const phoneNumber = bestNumber.number;

    if (!phoneNumber) {
      Alert.alert(
        "No Phone Number",
        "This contact does not have a phone number."
      );
      return;
    }

    const normalizedPhoneNumber = validatePhoneNumber(phoneNumber);

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

      const token = await SecureStore.getItemAsync("user_jwt_token");

      if (!token) {
        Alert.alert("Authentication Required", "Please register/login first.");
        return;
      }

      const response = await fetch(`${SPECIFIC_backend_url}/send-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserHash: hashedPhoneNumber }),
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        await SecureStore.deleteItemAsync("user_jwt_token");
        return;
      }

      if (response.ok) {
        console.log("Feedback sent successfully");
      } else {
        const errorData = await response.json();
        console.error("Failed:", errorData.message);
        Alert.alert("Error", errorData.message || "Something went wrong.");
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
          if (intervalRef.current) clearInterval(intervalRef.current);
          setProgress(0);
          setButtonColor("transparent");
          sendApprovalRequest();
          return 1;
        }
        setButtonColor(getRandomMatteColor());
        return prev + 0.01; // 100 steps * 50ms = 5000ms (5 seconds)
      });
    }, 50);
  };

  const handlePressOut = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress(0);
    setButtonColor("transparent");
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
        <View style={styles.inputContainer}>
          <Text style={styles.label}>type-contact-name</Text>
          <TextInput
            style={styles.input}
            onChangeText={handleSearch}
            value={person}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {foundContact && (
            <Text style={styles.contactInfo}>Found: {foundContact.name}</Text>
          )}
        </View>

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.buttonContainer}
        >
          <View
            style={[
              styles.fillingLayer,
              {
                width: `${progress * 100}%`,
                backgroundColor: buttonColor,
              },
            ]}
          />
          <Text style={styles.buttonText}>send</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    
  },
  inputContainer: {
    width: "100%",
    marginBottom: 48,
    
  },
  label: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "lowercase",
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1.5,
    borderColor: "#000000",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#ffffff",
    borderRadius : 10,
  },
  buttonContainer: {
    width: "100%",
    height: 54,
    borderWidth: 1.5,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "transparent",
    borderRadius : 10,
  },
  fillingLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    zIndex: 1,
    textTransform: "lowercase",
  },
  contactInfo: {
    marginTop: 8,
    fontSize: 14,
    color: "#666666",
  },
});