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
  const krakenTrades: FetchTradesReturnType = await kraken.fetchTrades(
    "BTC/USDT"
  );
  const binanceTrades: FetchTradesReturnType = await binance.fetchTrades(
    "BTC/USDT"
  );

  const trades: FetchTradesReturnType = { ...binanceTrades, ...krakenTrades };
  console.log(trades);
  console.log("trades above");

  await insertTradesToNotion(trades);
}
main();
