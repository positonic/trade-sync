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

// Exchange names
//const exchangeNames = ["binance", "kraken"];
const exchangeNames = ["binance"];

// Initialize exchanges
interface ApiKeys {
  [key: string]: ApiKey;
}

const exchanges = exchangeNames.reduce((acc, name) => {
  acc[name] = new Exchange(
    ccxt,
    apiKeys[name].apiKey,
    apiKeys[name].apiSecret,
    name
  );
  return acc;
}, {} as Record<string, Exchange>);

// Main function to execute the process
async function main() {
  const market = "TIA/USDT";
  //let allTrades: FetchTradesReturnType = {};
  let allTrades: any = [];

  for (const exchangeName of exchangeNames) {
    const exchange = exchanges[exchangeName];
    try {
      const exchangeTrades: FetchTradesReturnType = await exchange.fetchTrades(
        market
      );
      //allTrades = { ...allTrades, ...exchangeTrades };

      const trades = Object.values(exchangeTrades);
      // console.log("exchangeTrades", exchangeTrades);
      // console.log("trades", trades);

      //console.log(`${exchangeName} - ${market}: Found ${trades.length} trades`);
      allTrades = allTrades.concat(trades);
    } catch (error) {
      console.error(`Error fetching trades from ${exchangeName}:`, error);
    }
  }

  //const allTradesArray = Object.values(allTrades);
  console.log(allTrades);
  console.log(`Found ${allTrades.length} trades in total`);
  // Example usage
  const aggregatedOrders = aggregateTrades(allTrades); // tradesArray is your array of trades
  console.log(aggregatedOrders);
  const positions = aggregatePositions(aggregatedOrders);
  console.log(positions);
  process.exit();
  await insertTradesToNotion(allTrades);
}

main();
