import { SPECIFIC_backend_url } from "@/constants";
import { router } from "expo-router";
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { validatePhoneNumber } from "@/utils/phone-number-validator";
import auth from '@react-native-firebase/auth';

export default function Index() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendSMS = async () => {
    if (!phoneNumber.trim()) {
      console.error("No phone number provided");
      return;
    }
    const validatedPhoneNumber = validatePhoneNumber(phoneNumber);
    if (!validatedPhoneNumber) {
      Alert.alert(
        "Phone number is not valid",
        "Please edit phone number with country code and try again. (+1XXX)",
      );
      return;
    }

    setIsLoading(true);
    try {
      // Native Firebase telefon doğrulamasını başlatır
      const confirmation = await auth().signInWithPhoneNumber(validatedPhoneNumber);
      setConfirmResult(confirmation);
      Alert.alert('Success', 'SMS Gönderildi!');
    } catch (error: any) {
      console.error("SMS sending error:", error);
      Alert.alert("Error", error.message || "Could not send SMS.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert("Input required", "Please enter the SMS code.");
      return;
    }
    setIsLoading(true);
    try {
      if (!confirmResult) return;

      // Gelen SMS kodunu doğrula
      await confirmResult.confirm(code);
      
      const user = auth().currentUser;
      const firebaseIdToken = await user?.getIdToken();

      // BACKENDDEN JWT TOKEN AL
      const response = await fetch(`${SPECIFIC_backend_url}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, firebaseId: firebaseIdToken }),
      });

      if (!response.ok) {
        throw new Error("Invalid code. Please try again.");
      }

      if (response.status === 200) {
        Alert.alert("Success!", "Your phone number has been verified.");
        const data = await response.json();
        if (data.token) {
          await SecureStore.setItemAsync("user_jwt_token", data.token);
        }
      }
      router.push("/");
      setPhoneNumber("");
      setCode("");
      setConfirmResult(null);
      Alert.alert('Success', 'Registered!');
    } catch (error: any) {
      console.error("Code verification error:", error);
      Alert.alert("Error", error.message || "Could not verify code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="Your phone number (+XXX)"
        onChangeText={setPhoneNumber}
        value={phoneNumber}
        keyboardType="phone-pad"
        readOnly={Boolean(confirmResult)}
      />

      {confirmResult && (
        <TextInput
          style={styles.input}
          placeholder="Enter SMS code"
          onChangeText={setCode}
          value={code}
          keyboardType="number-pad"
        />
      )}

      <Pressable
        onPress={confirmResult ? verifyCode : sendSMS}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? "#0056b3" : "#007bff" },
          isLoading && styles.buttonDisabled,
        ]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {confirmResult ? "Verify Code" : "Send SMS"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  button: {
    width: "100%",
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#a0a0a0",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});