import path from "path";
import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
import registerUserRouter from "./routes/auth";
import uploadRouter from "./routes/upload";
import claimRouter from "./routes/claim";
import { logDailyCoins } from "./functions/dailyLogs";
import { sendPushNotification } from "./functions/pushNotification";
import { database } from "./lib/firebase/config";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const cronExpression = "59 23 * * *"; // 11:59 PM

app.use(express.json());

//* Main Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "html", "serverStatus.html"));
});

//* Health Check Route
app.get("/health", (req, res) => {
  // Normal Healthy response:
  res.status(200).json({ status: "ok" });

  // Error Response Sample
  // res.status(500).json({ status: "error" });
});

//* API Routes
app.use("/auth", registerUserRouter);
app.use("/upload", uploadRouter);
app.use("/claim", claimRouter);

//* Firebase RTDB Listener for Machine Status
const machineStatusRef = database.ref("/hopper/status");

machineStatusRef.on("value", async (snapshot) => {
  try {
    const status = snapshot.val();

    if (!status) {
      console.log("⚠️ Machine status is null or undefined");
      return;
    }

    console.log("🔔 Machine status changed:", status);

    // Determine notification details based on status
    let title = "";
    let body = "";
    let notificationType = "info";

    // Only two states: run or stop
    if (status === "run") {
      title = "Machine Activated 🟢";
      body = "The BarCoin counter is now up and running.";
      notificationType = "success";
    } else if (status === "stop") {
      title = "Machine Deactivated 🔴";
      body = "The BarCoin counter has been turned off.";
      notificationType = "warning";
    } else {
      // Fallback for unexpected status
      return; // Don't send a notification for an unknown status
    }

    // Send notification
    await sendPushNotification(
      title,
      body,
      notificationType,
      { status },
      "admin" // Send to admins only
    );

    console.log(`✅ Machine status notification sent: ${title}`);
  } catch (error) {
    console.error("❌ Error handling machine status change:", error);
  }
});

//* Daily Logs
cron.schedule(cronExpression, async () => {
  try {
    const logEntry = await logDailyCoins();

    // Calculate totals
    let totalCoins = 0;
    let totalValue = 0;

    for (const coinType in logEntry.coins) {
      const coinData = logEntry.coins[coinType as keyof typeof logEntry.coins];
      totalCoins += coinData.total;

      // Calculate value based on coin type
      if (coinType === "onePeso") totalValue += coinData.total * 1;
      if (coinType === "fivePeso") totalValue += coinData.total * 5;
      if (coinType === "tenPeso") totalValue += coinData.total * 10;
      if (coinType === "twentyPeso") totalValue += coinData.total * 20;
    }

    // Send notification
    await sendPushNotification(
      "Daily Log Created 📝",
      `${totalCoins} coins collected worth ₱${totalValue.toFixed(2)}`,
      "daily_log",
      {
        date: logEntry.timestamp,
        totalCoins,
        totalValue,
        coins: logEntry.coins,
      },
      "admin" // Only send to admins
    );

    console.log("✅ Daily log saved and notification sent.");
  } catch (error) {
    console.error("❌ Error in daily log cron job:", error);
  }
});

// ! Test Daily Log Notification
// app.post("/test/daily-log", async (req, res) => {
//   try {
//     console.log("Testing daily log notification...");

//     // Create the daily log
//     const logEntry = await logDailyCoins();

//     // Calculate total coins
//     let totalCoins = 0;
//     let totalValue = 0;

//     for (const coinType in logEntry.coins) {
//       const coinData = logEntry.coins[coinType as keyof typeof logEntry.coins];
//       totalCoins += coinData.total;

//       if (coinType === "onePeso") totalValue += coinData.total * 1;
//       if (coinType === "fivePeso") totalValue += coinData.total * 5;
//       if (coinType === "tenPeso") totalValue += coinData.total * 10;
//       if (coinType === "twentyPeso") totalValue += coinData.total * 20;
//     }

//     // Send notification
//     const result = await sendPushNotification(
//       "Daily Log Created 📊",
//       `${totalCoins} coins collected worth ₱${totalValue.toFixed(2)}`,
//       "daily_log",
//       {
//         date: logEntry.timestamp,
//         totalCoins,
//         totalValue,
//         coins: logEntry.coins,
//       },
//       "all" // or "admin" for testing
//     );

//     res.json({
//       success: true,
//       message: "Test notification sent!",
//       logEntry,
//       notification: result,
//     });
//   } catch (error) {
//     console.error("❌ Test failed:", error);
//     res.status(500).json({ success: false, error: String(error) });
//   }
// });

// * Start the Express server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
