import { firestore, admin } from "../lib/firebase/config";
import { Expo, ExpoPushTicket, ExpoPushReceiptId } from "expo-server-sdk";

let expo = new Expo({ useFcmV1: true });

/**
 * Get Expo Push Tokens
 * @param userRole - 'admin' for admins only, 'all' for everyone, or specific userId
 */
async function getExpoTokens(
  userRole?: "admin" | "all" | string
): Promise<string[]> {
  try {
    const usersCollection = firestore.collection("users");
    const tokensSet = new Set<string>();

    if (userRole === "admin") {
      const adminSnapshot = await usersCollection
        .where("role", "==", "admin")
        .get();

      adminSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData && Array.isArray(userData.expoPushTokens)) {
          userData.expoPushTokens.forEach((token: string) => {
            tokensSet.add(token);
          });
        }
      });
    } else if (userRole === "all" || !userRole) {
      const usersSnapshot = await usersCollection.get();
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData && Array.isArray(userData.expoPushTokens)) {
          userData.expoPushTokens.forEach((token: string) => {
            tokensSet.add(token);
          });
        }
      });
    } else {
      // Specific user
      const userDoc = await usersCollection.doc(userRole).get();
      const userData = userDoc.data();
      if (userData && Array.isArray(userData.expoPushTokens)) {
        userData.expoPushTokens.forEach((token: string) => {
          tokensSet.add(token);
        });
      }
    }

    return Array.from(tokensSet);
  } catch (error) {
    console.error("Error retrieving tokens:", error);
    return [];
  }
}

/**
 * Store notification in Firestore
 */
async function storeNotification(
  title: string,
  body: string,
  type: string,
  data?: any
) {
  try {
    await firestore.collection("notifications").add({
      title,
      body,
      type,
      data,
      read: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✅ Notification stored in Firestore");
  } catch (error) {
    console.error("❌ Error storing notification:", error);
  }
}

/**
 * Send Push Notification
 * @param title - Notification title
 * @param body - Notification body
 * @param type - Notification type (e.g., 'daily_log', 'transaction', 'alert')
 * @param data - Additional data payload (optional)
 * @param recipient - 'admin', 'all', or specific userId (optional, defaults to 'all')
 */
export async function sendPushNotification(
  title: string,
  body: string,
  type: string = "normal",
  data?: any,
  recipient: "admin" | "all" | string = "all"
) {
  const tokenArray = await getExpoTokens(recipient);

  if (tokenArray.length === 0) {
    console.log("⚠️ No tokens found for:", recipient);
    return { success: false, message: "No tokens found" };
  }

  let messages = [];

  for (let token of tokenArray) {
    if (!Expo.isExpoPushToken(token)) {
      console.error(`❌ Invalid token: ${token}`);
      continue;
    }

    messages.push({
      to: token,
      sound: "default",
      title,
      body,
      data: { ...data, type },
      priority: "high" as const,
      channelId: "default",
    });
  }

  let chunks = expo.chunkPushNotifications(messages);
  let tickets: ExpoPushTicket[] = [];

  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("❌ Error sending notifications:", error);
    }
  }

  let receiptIds: ExpoPushReceiptId[] = [];
  for (let ticket of tickets) {
    if (ticket.status === "ok") {
      receiptIds.push(ticket.id);
    }
  }

  let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (let chunk of receiptIdChunks) {
    try {
      let receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (let receiptId in receipts) {
        let { status, details } = receipts[receiptId];
        if (status === "error") {
          console.error(`❌ Notification error: ${(details as any).error}`);
        }
      }
    } catch (error) {
      console.error("❌ Error checking receipts:", error);
    }
  }

  await storeNotification(title, body, type, data);
  console.log("✅ Push notification sent successfully");

  return { success: true, message: "Notification sent" };
}
