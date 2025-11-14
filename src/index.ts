import path from "path";
import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
import registerUserRouter from "./routes/auth";
import { logDailyCoins, claimMachineMoney } from "./functions/dailyLogs";

dotenv.config(); // Load environment variables

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

//* Daily Logs
cron.schedule(cronExpression, () => {
  console.log("Saved today's log.");
  logDailyCoins();
});

// * Start the Express server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
