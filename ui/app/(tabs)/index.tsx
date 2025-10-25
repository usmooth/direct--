import { Link, Stack } from "expo-router";
import { useState, useRef } from "react";
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

export default function Index() {
  const [person, setPerson] = useState("");
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const sendApprovalRequest = async () => {
    // Prevent sending request if person is not set
    if (!person.trim()) {
      Alert.alert("Input required", "Please type something before approving.");
      return;
    }

    try {
      // TODO: Replace with your actual backend endpoint and request details
      const response = await fetch("localhost:3000/send-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: person }),
      });

      const responseData = await response.json();
      Alert.alert("Success!", `Approved for: ${person}`);
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
          sendApprovalRequest();
          return 1;
        }
        return prev + 0.01; // 10ms * 500 steps = 5000ms = 5s
      }); // This interval is not perfectly accurate, but fine for UI purposes
    }, 50); // Update every 50ms
  };

  const handlePressOut = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress(0);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Home",
          headerShown: true,
          headerRight: () => (
            <Link href="/register" style={{ padding: 10 }}>
              <Text style={{ fontSize: 24 }}>🔔</Text>
            </Link>
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
          onChangeText={setPerson}
          value={person}
        />
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
});
