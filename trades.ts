import dotenv from "dotenv";
import { insertTradesToNotion } from "./notion";
import Exchange, {
  FetchTradesReturnType,
  aggregatePositions,
  aggregateTrades,
} from "./exchanges/Exchange";
import ccxt from "ccxt";

dotenv.config();

interface ApiKeys {
  kraken: ApiKey;
  binance: ApiKey;
}
interface ApiKey {
  apiKey: string;
  apiSecret: string;
}

// API keys
const apiKeys: ApiKeys = {
  kraken: {
    apiKey: process.env.KRAKEN_API_KEY as string,
    apiSecret: process.env.KRAKEN_API_SECRET as string,
  },
  binance: {
    apiKey: process.env.BINANCE_API_KEY as string,
    apiSecret: process.env.BINANCE_API_SECRET as string,
  },
};
interface ExchangeConfig {
  exchange: string;
  pairs: string[];
}
// Exchange names
//const exchangeNames = ["binance", "kraken"];
//const exchangeNames = ["binance"];
// const config: ExchangeConfig[] = [
//   {
//     exchange: "binance",
//     pairs: ["TIA/USDT", "BTC/USD"],
//   },
//   { exchange: "kraken", pairs: ["TIA/USDT", "ETH/USD"] },
// ];
const config: ExchangeConfig[] = [
  {
    exchange: "binance",
    pairs: ["ENS/USDT"],
  },
];
const insertTradesInNotion = false;
// Initialize exchanges
interface ApiKeys {
  [key: string]: ApiKey;
}

const exchanges = Object.keys(apiKeys).reduce((acc, name) => {
  acc[name] = new Exchange(
    ccxt,
    apiKeys[name].apiKey,
    apiKeys[name].apiSecret,
    name
  );
  return acc;
}, {} as Record<string, Exchange>);
async function main() {
  let allTrades: any = [];

  for (const { exchange: exchangeName, pairs } of config) {
    const exchange = exchanges[exchangeName];
    if (!exchange) continue; // Skip if the exchange is not initialized

    for (const pair of pairs) {
      try {
        const exchangeTrades: FetchTradesReturnType =
          await exchange.fetchTrades(pair);
        const trades = Object.values(exchangeTrades);
        console.log(`${exchangeName} - ${pair}: Found ${trades.length} trades`);
        allTrades = allTrades.concat(trades);
      } catch (error) {
        console.error(
          `Error fetching trades from ${exchangeName} for ${pair}:`,
          error
        );
      }
    }
  }

  console.log(allTrades);
  console.log(`Found ${allTrades.length} trades in total`);

  // Aggregation logic
  const aggregatedOrders = aggregateTrades(allTrades);
  console.log(aggregatedOrders);
  console.log(`Aggregated into ${aggregatedOrders.length} orders in total`);
  const positions = aggregatePositions(aggregatedOrders);
  console.log(positions);
  console.log(`Aggregated into ${positions.length} positions in total`);

  if (insertTradesInNotion) {
    await insertTradesToNotion(allTrades);
  }
}

main();
