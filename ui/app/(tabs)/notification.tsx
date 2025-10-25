import { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";

interface Notification {
  mutualFeedbackHash: string;
}

export default function Index() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with your actual backend endpoint
      const response = await fetch(
        "https://your-backend.com/api/notifications"
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Notification[] = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      // You could set an error state here to show a message to the user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={fetchNotifications}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? "#0056b3" : "#007bff" },
          isLoading && styles.buttonDisabled,
        ]}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Loading..." : "Refresh Notifications"}
        </Text>
      </Pressable>

      {isLoading && notifications.length === 0 && (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: "#a0a0a0",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  loader: {
    marginTop: 50,
  },
  list: {
    width: "100%",
  },
  notificationItem: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    color: "#666",
  },
});
