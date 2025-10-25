import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";

export default function Index() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [isSmsSent, setIsSmsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("Input required", "Please enter your phone number.");
      return;
    }
    setIsLoading(true);
    try {
      // TODO: Replace with your endpoint to send an SMS
      const response = await fetch("https://your-backend.com/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        throw new Error("Failed to send SMS. Please try again.");
      }

      setIsSmsSent(true);
      Alert.alert(
        "SMS Sent!",
        "Please check your messages for a verification code."
      );
    } catch (error: any) {
      console.error("SMS sending error:", error);
      Alert.alert("Error", error.message || "Could not send SMS.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!smsCode.trim()) {
      Alert.alert("Input required", "Please enter the SMS code.");
      return;
    }
    setIsLoading(true);
    try {
      // TODO: Replace with your endpoint to verify the code
      const response = await fetch("https://your-backend.com/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code: smsCode }),
      });

      if (!response.ok) {
        throw new Error("Invalid code. Please try again.");
      }

      Alert.alert("Success!", "Your phone number has been verified.");
    } catch (error: any) {
      console.error("Code verification error:", error);
      Alert.alert("Error", error.message || "Could not verify code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register Your Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your phone number"
        onChangeText={setPhoneNumber}
        value={phoneNumber}
        keyboardType="phone-pad"
        editable={!isSmsSent} // Disable editing after SMS is sent
      />

      {isSmsSent && (
        <TextInput
          style={styles.input}
          placeholder="Enter SMS code"
          onChangeText={setSmsCode}
          value={smsCode}
          keyboardType="number-pad"
        />
      )}

      <Pressable
        onPress={isSmsSent ? handleVerifyCode : handleSendSms}
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
            {isSmsSent ? "Verify Code" : "Send SMS"}
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
