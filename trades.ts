import dotenv from "dotenv";
import ccxt from "ccxt";
import { Kraken } from "./exchanges/Kraken";
import { Trade } from "interfaces/Trade";
import { insertTradesToNotion } from "./notion";

dotenv.config();

// Kraken API details
const krakenApiKey = process.env.KRAKEN_API_KEY as string;
const krakenApiSecret = process.env.KRAKEN_API_SECRET as string;

const binanceApiKey = process.env.BINANCE_API_KEY;
const binanceSecret = process.env.BINANCE_API_SECRET;

// Initialize Kraken client
const kraken = new Kraken(krakenApiKey, krakenApiSecret);

async function fetchBinanceTrades() {
  try {
    // Initialize Binance client
    const binance = new ccxt.binance({
      apiKey: binanceApiKey,
      secret: binanceSecret,
    });

    const since = undefined; // or some timestamp in milliseconds
    const limit = 50; // number of trades to fetch
    const rawTrades = await binance.fetchMyTrades("BTC/USDT", since, limit); // replace 'BTC/USDT' with your market
    console.log("Binance response:", rawTrades);
    const normalizedTrades = rawTrades.map((trade) => ({
      id: trade.id,
      ordertxid: trade.order,
      pair: trade.symbol,
      time: trade.timestamp,
      type: trade.side,
      ordertype: "", // Binance might not provide a direct mapping
      price: trade.price.toString(),
      cost: (trade.price * (trade.amount ?? 0)).toString(),
      fee: trade.fee?.cost?.toString() ?? "0", // Ensure proper handling if fee is null
      vol: trade.amount,
      margin: "", // Binance might not provide this directly
      leverage: "", // Binance might not provide this directly
      misc: "", // or any other details you might want to include
      exchange: "Binance",
    }));
    return Object.fromEntries(
      normalizedTrades.map((trade) => [trade.id, trade])
    );
  } catch (error) {
    console.error("Error fetching trades from Binance:", error);
    return [];
  }
}
// Main function to execute the process
async function main() {
  const binanceTrades: Record<string, Trade> = await fetchBinanceTrades();
  const krakenTrades: Record<string, Trade> = await kraken.fetchKrakenTrades();
  const trades: Record<string, Trade> = { ...binanceTrades, ...krakenTrades };
  console.log(trades);
  await insertTradesToNotion(binanceTrades);
}
main();
