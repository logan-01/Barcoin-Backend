import express from "express";
import { sendPushNotification } from "../functions/pushNotification";
import { formatName } from "../functions/helper";

const claimRouter = express.Router();

/**
 * POST /claim/notify
 * Sends notification after coins are claimed
 *
 * Request body:
 * {
 *   userId: string,
 *   userName: string,
 *   userRole: string,
 *   totalCoins: number,
 *   totalValue: number,
 *   coins: CoinsCollection
 * }
 */

claimRouter.post("/notify", async (req, res) => {
  try {
    const { userId, userName, userRole, totalCoins, totalValue, coins } =
      req.body;

    // Validate required fields
    if (
      !userId ||
      !userName ||
      !userRole ||
      totalCoins === undefined ||
      totalValue === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: userId, userName, userRole, totalCoins, totalValue",
      });
    }

    const formattedName = formatName(userName);
    const timestamp = new Date().toISOString();

    // Send personalized notification to the claimer
    await sendPushNotification(
      "Coins Claimed Successfully! 🎉",
      `You have successfully claimed ${totalCoins} coins worth ₱${totalValue.toFixed(
        2
      )}`,
      "claim_logs", // Changed to claim_logs
      {
        userId,
        userName,
        userRole,
        timestamp,
        totalCoins,
        totalValue,
        coins,
      },
      userId // Send to the specific user who claimed
    );

    // Send detailed notification to all admins (EXCLUDING the claimer if they're an admin)
    await sendPushNotification(
      "Coins Claimed Successfully 💰",
      `${formattedName} claimed ${totalCoins} coins worth ₱${totalValue.toFixed(
        2
      )}`,
      "claim_logs", // Changed to claim_logs
      {
        userId,
        userName,
        userRole,
        timestamp,
        totalCoins,
        totalValue,
        coins,
      },
      "admin", // Send to all admins
      userId // EXCLUDE the claimer from receiving this notification
    );

    // Send simplified notification to all other regular users (EXCLUDING the claimer)
    await sendPushNotification(
      "Coins Claimed 💰",
      `Someone has claimed coins from the machine`,
      "claim_logs", // Changed to claim_logs
      {
        userId,
        userName,
        userRole,
        timestamp,
        // No detailed coin data for regular users
      },
      "user", // Send to regular users only
      userId // EXCLUDE the claimer from receiving this notification
    );

    console.log(
      `✅ Claim notifications sent for ${userName}: ${totalCoins} coins, ₱${totalValue}`
    );

    res.json({
      success: true,
      message: "Notifications sent successfully",
      data: {
        userName,
        totalCoins,
        totalValue,
      },
    });
  } catch (error) {
    console.error("❌ Error in claim notification endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: String(error),
    });
  }
});

export default claimRouter;
