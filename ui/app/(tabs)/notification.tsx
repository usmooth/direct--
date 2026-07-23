import { SPECIFIC_backend_url } from "@/constants";
import { useState, useEffect } from "react";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Contacts from 'expo-contacts';
import { validatePhoneNumber } from "@/utils/phone-number-validator";

interface Notification {
  id: string;
  context: string;
  notificationTime: Date;
  skt: Date;
  to: string;
  title?: string;   // Added optional fields used in renderItem
  message?: string; // Added optional fields used in renderItem
}

export default function Index() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [contactMap, setContactMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    prepareData();
  }, []);

  const prepareData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch contacts and notifications simultaneously
      const [contactData, notificationData] = await Promise.all([
        fetchAndHashContacts(),
        fetchNotifications()
      ]);

      setContactMap(contactData);
      setNotifications(notificationData ?? []);
    } catch (error) {
      console.error("Error preparing data:", error);
    } finally {
      setIsLoading(false);
    }
  };  

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync("user_jwt_token");

      const response = await fetch(`${SPECIFIC_backend_url}/get-notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Notification[] = (await response.json())?.notifications;
      return data;
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAndHashContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return {};

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.FirstName, Contacts.Fields.LastName],
    });

    const hashToNameMap: Record<string, string> = {};

    // Parallelize hashing operations using Promise.all for better performance
    await Promise.all(data.map(async (contact) => {
      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        for (const phone of contact.phoneNumbers) {
          if (!phone.number) continue;
          const normalized = validatePhoneNumber(phone.number);
          
          if (normalized) {
            const hashed = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              normalized
            );
            
            const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            hashToNameMap[hashed] = fullName || phone.number;
          }
        }
      }
    }));

    return hashToNameMap;
  };

  const renderItem = ({ item }: { item: Notification }) => {
    // Map hash to contact name, fallback to "unknown contact" if not found
    const contactName = contactMap[item.context] || "unknown contact";

    return (
      <View style={styles.card}>
        <Text style={styles.contactName}>{contactName}</Text>
        {item.title && <Text style={styles.title}>{item.title}</Text>}
        {item.message && <Text style={styles.message}>{item.message}</Text>}
      </View>
    );
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={notifications.length === 0 && styles.emptyListContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>no notifications found.</Text>}
      />
      
      <Pressable
        onPress={fetchNotifications}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.buttonText}>refresh</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 32,
  },
  list: {
    width: "100%",
    flex: 1,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    textTransform: "lowercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: "#666666",
  },
  emptyText: {
    fontSize: 14,
    color: "#000000",
    textTransform: "lowercase",
    textAlign: "center",
  },
  button: {
    width: "100%",
    height: 54,
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    marginTop: 16,
  },
  buttonPressed: {
    backgroundColor: "#f5f5f5",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    textTransform: "lowercase",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
