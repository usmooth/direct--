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
      
      // 1. Rehber ve Bildirimleri eş zamanlı çekelim
      const [contactData, notificationData] = await Promise.all([
        fetchAndHashContacts(),
        fetchNotifications() // Backend'den gelen veriler
      ]);

      setContactMap(contactData);
      setNotifications(notificationData ?? []);
    } catch (error) {
      console.error("Veri hazırlanırken hata oluştu:", error);
    } finally {
      setIsLoading(false);
    }
  };  

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync("user_jwt_token");

      // TODO: Replace with your actual backend endpoint
      const response = await fetch(`${SPECIFIC_backend_url}/get-notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // JWT BURADA EKLENİYOR
        }
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Notification[] = (await response.json())?.notifications;
      return data;
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      // You could set an error state here to show a message to the user
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

    // Performans için Promise.all kullanarak hashleme işlemlerini paralelleştiriyoruz
    await Promise.all(data.map(async (contact) => {
      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        for (const phone of contact.phoneNumbers) {
          if (!phone.number) continue;
          const normalized = validatePhoneNumber(phone.number); // Senin fonksiyonun
          
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
    // Hash'i isme dönüştür, bulamazsan orijinal hash'i (veya 'Bilinmeyen') göster
    const contactName = contactMap[item.context] || "Bilinmeyen Numara";

    return (
      <View style={styles.card}>
        <Text style={styles.contactName}>{contactName}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
      </View>
    );
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>Bildirim bulunamadı.</Text>}
      />
      <Pressable
        onPress={fetchNotifications}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? "#0056b3" : "#007bff" },
          isLoading && styles.buttonDisabled,
        ]}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Refresh Notifications</Text>
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
    justifyContent: "flex-end",
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
    width: "100%",
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
  message: { color: '#666', marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2 },
  contactName: { fontWeight: 'bold', color: '#007AFF', fontSize: 16 },
  title: { fontWeight: '600', marginTop: 5 },

});
