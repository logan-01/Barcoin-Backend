import express from "express";
import { sendPushNotification } from "../functions/pushNotification";

const claimRouter = express.Router();

/**
 * POST /claim/notify
 * Sends notification after coins are claimed
 *
 * Request body:
 * {
 *   userId: string,
 *   userName: string,
 *   totalCoins: number,
 *   totalValue: number,
 *   coins: CoinsCollection
 * }
 */

const formatName = (name: string) => {
  return name.replace(/\//g, " ");
};

claimRouter.post("/notify", async (req, res) => {
  try {
    const { userId, userName, totalCoins, totalValue, coins } = req.body;

    // Validate required fields
    if (
      !userId ||
      !userName ||
      totalCoins === undefined ||
      totalValue === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: userId, userName, totalCoins, totalValue",
      });
    }

    // Send push notification to all admins
    const result = await sendPushNotification(
      "Coins Claimed Successfully 💰",
      `${formatName(
        userName
      )} claimed ${totalCoins} coins worth ₱${totalValue.toFixed(2)}`,
      "transaction",
      {
        userId,
        userName,
        timestamp: new Date().toISOString(),
        totalCoins,
        totalValue,
        coins,
      },
      "admin" // Send to all admins only
    );

    console.log(
      `✅ Claim notification sent for ${userName}: ${totalCoins} coins, ₱${totalValue}`
    );

    res.json({
      success: true,
      message: "Notification sent successfully",
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
