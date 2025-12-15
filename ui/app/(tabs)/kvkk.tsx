import { SPECIFIC_backend_url } from "@/constants";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View, Pressable, Alert } from "react-native";

export default function Kvkk() {
  const [isChecked, setIsChecked] = useState(false);

  const handleAccept = () => {
    if (isChecked) {
      Alert.alert("Accepted", "You have accepted the terms.");
      router.push("/");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kvkk falan</Text>
      <View style={styles.checkboxContainer}>
        <Pressable
          onPress={() => setIsChecked(!isChecked)}
          style={styles.checkbox}
        >
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </Pressable>
        <Text style={styles.label}>I have read and accept the terms.</Text>
      </View>
      <Pressable
        onPress={handleAccept}
        style={[styles.button, !isChecked && styles.buttonDisabled]}
        disabled={!isChecked}
      >
        <Text style={styles.buttonText}>Accept</Text>
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
  checkboxContainer: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#007bff",
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    color: "#007bff",
    fontSize: 18,
  },
  label: {
    fontSize: 16,
  },
});
