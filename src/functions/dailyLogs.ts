import { database } from "../lib/firebase/config";

const COIN_TYPES = ["onePeso", "fivePeso", "tenPeso", "twentyPeso"] as const;
type CoinType = (typeof COIN_TYPES)[number];

interface CoinCount {
  old: number; // Old design coins counted by machine
  new: number; // New design coins counted by machine
  total: number; // Total coins in machine
}

type CoinsData = Record<CoinType, CoinCount>;

interface DailyLogCoins {
  old: number; // Old design coins counted TODAY
  new: number; // New design coins counted TODAY
  total: number; // Total coins counted TODAY
}

interface DailyLog {
  timestamp: string;
  claimed: boolean;
  coins: Record<CoinType, DailyLogCoins>;
}

/**
 * Gets the current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Gets current timestamp in ISO format
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Reads current coin counts from Firebase (machine's current state)
 */
async function getCurrentCoinCounts(): Promise<CoinsData> {
  const snapshot = await database.ref("coinsCount").once("value");
  const data = snapshot.val() || {};
  const coinsData: CoinsData = {} as CoinsData;

  for (const coin of COIN_TYPES) {
    coinsData[coin] = {
      old: data[coin]?.old || 0,
      new: data[coin]?.new || 0,
      total: data[coin]?.total || 0,
    };
  }
  return coinsData;
}

/**
 * Gets yesterday's final counts (to calculate today's difference)
 */
async function getYesterdayFinalCounts(): Promise<CoinsData | null> {
  const snapshot = await database.ref("yesterdayFinalCounts").once("value");
  const data = snapshot.val();

  if (!data) return null;

  const coinsData: CoinsData = {} as CoinsData;
  for (const coin of COIN_TYPES) {
    coinsData[coin] = {
      old: data[coin]?.old || 0,
      new: data[coin]?.new || 0,
      total: data[coin]?.total || 0,
    };
  }
  return coinsData;
}

/**
 * Gets the last date a log was created
 */
async function getLastLogDate(): Promise<string | null> {
  const snapshot = await database.ref("lastLogDate").once("value");
  return snapshot.val();
}

/**
 * Creates or updates the daily log
 */
async function createOrUpdateDailyLog(
  date: string,
  coins: Record<CoinType, DailyLogCoins>,
  isClaimed = false
): Promise<DailyLog> {
  const logRef = database.ref(`dailyLogs/${date}`);

  const logEntry: DailyLog = {
    timestamp: getCurrentTimestamp(),
    claimed: isClaimed,
    coins: coins,
  };

  await logRef.set(logEntry);
  return logEntry;
}

/**
 * Logs daily coins - tracks coins counted TODAY only
 */
async function logDailyCoins(): Promise<DailyLog> {
  const currentDate = getCurrentDate();
  const currentCounts = await getCurrentCoinCounts();
  const lastLogDate = await getLastLogDate();

  let isNewDay = false;
  let yesterdayFinalCounts = await getYesterdayFinalCounts();

  // Check if this is a new day
  if (lastLogDate !== currentDate) {
    isNewDay = true;

    // If we have yesterday's data, use it
    // If not (first run ever), use zeros
    if (yesterdayFinalCounts === null) {
      yesterdayFinalCounts = {} as CoinsData;
      for (const coin of COIN_TYPES) {
        yesterdayFinalCounts[coin] = { old: 0, new: 0, total: 0 };
      }
    }

    // Update the date
    await database.ref("lastLogDate").set(currentDate);
  }

  // Calculate coins counted TODAY
  const dailyLogCoins: Record<CoinType, DailyLogCoins> = {} as Record<
    CoinType,
    DailyLogCoins
  >;

  if (isNewDay) {
    // NEW DAY: Calculate difference from yesterday
    for (const coin of COIN_TYPES) {
      const currentOld = currentCounts[coin].old;
      const currentNew = currentCounts[coin].new;
      const currentTotal = currentCounts[coin].total;

      const yesterdayOld = yesterdayFinalCounts![coin].old;
      const yesterdayNew = yesterdayFinalCounts![coin].new;
      const yesterdayTotal = yesterdayFinalCounts![coin].total;

      // Coins counted TODAY = current - yesterday
      dailyLogCoins[coin] = {
        old: Math.max(0, currentOld - yesterdayOld),
        new: Math.max(0, currentNew - yesterdayNew),
        total: Math.max(0, currentTotal - yesterdayTotal),
      };
    }
  } else {
    // SAME DAY: Use absolute current counts (what machine shows)
    for (const coin of COIN_TYPES) {
      dailyLogCoins[coin] = {
        old: currentCounts[coin].old,
        new: currentCounts[coin].new,
        total: currentCounts[coin].total,
      };
    }
  }

  // ALWAYS update yesterdayFinalCounts with current counts
  // This ensures it's ready for the next day
  await database.ref("yesterdayFinalCounts").set(currentCounts);

  const logEntry = await createOrUpdateDailyLog(
    currentDate,
    dailyLogCoins,
    false
  );

  console.log(`Daily log updated for ${currentDate}:`, logEntry);
  return logEntry;
}

/**
 * Claim machine money and reset counts
 */
async function claimMachineMoney(): Promise<{
  success: boolean;
  claimed: true;
  finalLog: DailyLog;
}> {
  const currentDate = getCurrentDate();
  const currentCounts = await getCurrentCoinCounts();
  const yesterdayFinalCounts = await getYesterdayFinalCounts();

  // Calculate final daily log
  const dailyLogCoins: Record<CoinType, DailyLogCoins> = {} as Record<
    CoinType,
    DailyLogCoins
  >;

  for (const coin of COIN_TYPES) {
    const currentOld = currentCounts[coin].old;
    const currentNew = currentCounts[coin].new;
    const currentTotal = currentCounts[coin].total;

    const yesterdayOld = yesterdayFinalCounts?.[coin]?.old || 0;
    const yesterdayNew = yesterdayFinalCounts?.[coin]?.new || 0;
    const yesterdayTotal = yesterdayFinalCounts?.[coin]?.total || 0;

    dailyLogCoins[coin] = {
      old: Math.max(0, currentOld - yesterdayOld),
      new: Math.max(0, currentNew - yesterdayNew),
      total: Math.max(0, currentTotal - yesterdayTotal),
    };
  }

  // Create final log with claimed = true
  const finalLog = await createOrUpdateDailyLog(
    currentDate,
    dailyLogCoins,
    true
  );

  // Reset coinsCount to zero (machine is now empty)
  const resetCounts: CoinsData = {} as CoinsData;
  for (const coin of COIN_TYPES) {
    resetCounts[coin] = { old: 0, new: 0, total: 0 };
  }
  await database.ref("coinsCount").set(resetCounts);

  // Reset yesterday's counts to zero
  await database.ref("yesterdayFinalCounts").set(resetCounts);

  console.log("Machine money claimed and counts reset.");
  return { success: true, claimed: true, finalLog };
}

export {
  // Main functions
  logDailyCoins,
  claimMachineMoney,

  // Utility functions
  getCurrentCoinCounts,

  // Constants and Types
  COIN_TYPES,
};

export type { CoinType, CoinsData, DailyLog, DailyLogCoins };
