import dotenv from "dotenv";
import { insertTradesToNotion } from "./notion";
import Exchange, { FetchTradesReturnType } from "./exchanges/Exchange";
import ccxt from "ccxt";

dotenv.config();

// Kraken API details
const krakenApiKey = process.env.KRAKEN_API_KEY as string;
const krakenApiSecret = process.env.KRAKEN_API_SECRET as string;

const binanceApiKey = process.env.BINANCE_API_KEY as string;
const binanceSecret = process.env.BINANCE_API_SECRET as string;

// Initialize Kraken client
const kraken = new Exchange(ccxt, krakenApiKey, krakenApiSecret, "kraken");
const binance = new Exchange(ccxt, binanceApiKey, binanceSecret, "binance");

// Main function to execute the process
async function main() {
  const onlyKrakan = true;
  const since = new Date("2023-12-01T00:00:00.000Z").getTime();

  const krakenTrades: FetchTradesReturnType = await kraken.fetchAllTrades(
    "BTC/USD",
    since
  );
  // const krakenTrades: FetchTradesReturnType = await kraken.fetchTrades(
  //   "BTC/USD"
  // );
  //const krakenTrades: FetchTradesReturnType = await kraken.fetchAllTrades();
  await insertTradesToNotion(krakenTrades);
  if (!onlyKrakan) {
    const binanceTrades: FetchTradesReturnType = await binance.fetchTrades(
      "BTC/USDT"
    );

    const trades: FetchTradesReturnType = { ...binanceTrades, ...krakenTrades };
    console.log(trades);
    console.log("trades above");
    await insertTradesToNotion(trades);
  } else {
    await insertTradesToNotion(krakenTrades);
  }
}
main();
