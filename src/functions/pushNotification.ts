import { firestore, admin } from "../lib/firebase/config";
import { Expo, ExpoPushTicket, ExpoPushReceiptId } from "expo-server-sdk";

let expo = new Expo({ useFcmV1: true });

/**
 * Get Expo Push Tokens
 * @param userRole - 'admin' for admins only, 'user' for regular users only, 'all' for everyone, or specific userId
 * @param excludeUserId - Optional userId to exclude from the token list
 */
async function getExpoTokens(
  userRole?: "admin" | "user" | "all" | string,
  excludeUserId?: string
): Promise<string[]> {
  try {
    const usersCollection = firestore.collection("users");
    const tokensSet = new Set<string>();

    if (userRole === "admin") {
      // Get tokens for both admin AND owner roles
      const adminSnapshot = await usersCollection
        .where("role", "in", ["admin", "owner"]) // ✅ Include both admin and owner
        .get();

      adminSnapshot.forEach((userDoc) => {
        // Skip if this is the excluded user
        if (excludeUserId && userDoc.id === excludeUserId) {
          return;
        }

        const userData = userDoc.data();
        if (userData && Array.isArray(userData.expoPushTokens)) {
          userData.expoPushTokens.forEach((token: string) => {
            tokensSet.add(token);
          });
        }
      });
    } else if (userRole === "user") {
      // Get only regular user tokens (not admins or owners)
      const usersSnapshot = await usersCollection.get();

      usersSnapshot.forEach((userDoc) => {
        // Skip if this is the excluded user
        if (excludeUserId && userDoc.id === excludeUserId) {
          return;
        }

        const userData = userDoc.data();
        // Only include users that are NOT admin or owner
        if (
          userData &&
          userData.role !== "admin" &&
          userData.role !== "owner" &&
          Array.isArray(userData.expoPushTokens)
        ) {
          userData.expoPushTokens.forEach((token: string) => {
            tokensSet.add(token);
          });
        }
      });
    } else if (userRole === "all" || !userRole) {
      // Get all user tokens
      const usersSnapshot = await usersCollection.get();
      usersSnapshot.forEach((userDoc) => {
        // Skip if this is the excluded user
        if (excludeUserId && userDoc.id === excludeUserId) {
          return;
        }

        const userData = userDoc.data();
        if (userData && Array.isArray(userData.expoPushTokens)) {
          userData.expoPushTokens.forEach((token: string) => {
            tokensSet.add(token);
          });
        }
      });
    } else {
      // Specific user by userId
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
  recipient: string,
  data?: any
) {
  try {
    await firestore.collection("notifications").add({
      title,
      body,
      type,
      data,
      readBy: [], // Initialize empty array for tracking who read the notification
      recipient, // 'admin', 'user', 'all', or specific userId
      dismissedBy: [], // Initialize empty array for tracking dismissed users
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Notification stored in Firestore for ${recipient}`);
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
 * @param recipient - 'admin', 'user', 'all', or specific userId (optional, defaults to 'all')
 * @param excludeUserId - Optional userId to exclude from receiving the push notification
 */
export async function sendPushNotification(
  title: string,
  body: string,
  type: string = "normal",
  data?: any,
  recipient: "admin" | "user" | "all" | string = "all",
  excludeUserId?: string
) {
  const tokenArray = await getExpoTokens(recipient, excludeUserId);

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

  await storeNotification(title, body, type, recipient, data);
  console.log(`✅ Push notification sent successfully to ${recipient}`);

  return { success: true, message: "Notification sent" };
}
