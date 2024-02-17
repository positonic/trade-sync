import dotenv from "dotenv";
import {
  insertTradesToNotion,
  insertPositionsToNotion,
  getLastTradeTimestamp,
} from "./notion";
import Exchange, {
  FetchTradesReturnType,
  aggregatePositions,
  aggregateTrades,
} from "./exchanges/Exchange";
import ccxt from "ccxt";
import minimist from "minimist";

const argv = minimist(process.argv.slice(2));
const exchange = argv.exchange;

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
let doGetTrades = false;
let doGetPositions = false;
let config: ExchangeConfig[] = [];

//const getPositionsFor = "kraken"; // "binance" | "kraken"

interface ExchangeConfig {
  exchange: string;
  pairs: string[];
  since?: number;
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
const krakenConfig: ExchangeConfig[] = [
  {
    exchange: "kraken",
    pairs: ["OP/USD", "LINK/USD"],
  },
];
const binancePairs = [
  "ETH/USDT",
  "ETH/USD",
  "ARB/USDT",
  "SUI/USDT",
  "BTC/USDT",
  "ETH/USDT",
  "MATIC/USDT",
  "ENS/USDT",
  "TIA/USDT",
  "OP/USDT",
  "OP/USD",
  "BLUR/USDT",
  "LINK/USDT",
  "LINK/USD",
  "ARB/USDT",
  "PENDLE/USDT",
];
//const june1st2021 = 1622505600000;
const today = new Date().getTime();

const binanceConfig: ExchangeConfig[] = [
  {
    exchange: "binance",
    pairs: binancePairs,
    since: today,
  },
];
let getPositionsFor: string = process.env.exchange as string;
getPositionsFor = getPositionsFor ? getPositionsFor : exchange;

if (getPositionsFor === "binance") {
  console.log("Getting positions for binance");
  config = binanceConfig;
} else if (getPositionsFor === "kraken") {
  console.log("Getting positions for kraken");
  config = krakenConfig;
}

const insertTradesInNotion = true;
const insertPositionsInNotion = false;
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
async function getTrades() {
  const lastTimestamp = await getLastTradeTimestamp();
  console.log("lastTimestamp is:", lastTimestamp);
  const since = lastTimestamp ? lastTimestamp + 1 : undefined; // Fetch trades after the last recorded trade

  let allTrades: any = [];

  for (const { exchange: exchangeName, pairs } of config) {
    const exchange = exchanges[exchangeName];
    if (!exchange) continue; // Skip if the exchange is not initialized

    for (const pair of pairs) {
      try {
        const exchangeTrades: FetchTradesReturnType =
          await exchange.fetchTrades(pair, since);
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
  if (insertPositionsInNotion) {
    await insertPositionsToNotion(positions);
  }
}

async function getAndSavePositions() {
  let allPositions: any = [];

  for (const { exchange: exchangeName, pairs } of config) {
    const exchange = exchanges[exchangeName];
    if (!exchange) continue; // Skip if the exchange is not initialized

    for (const pair of pairs) {
      try {
        const positions: FetchTradesReturnType = await exchange.fetchPositions(
          pair,
          exchangeName
        );

        console.log(
          `${exchangeName} - ${pair}: Built ${positions.length} positions`
        );
        allPositions = allPositions.concat(positions);
      } catch (error) {
        console.error(
          `Error fetching trades from ${exchangeName} for ${pair}:`,
          error
        );
      }
    }
  }

  console.log(allPositions);
  console.log(`Built ${allPositions.length} allPositions in total`);

  // if (insertTradesInNotion) {
  //   await insertTradesToNotion(allTrades);
  // }
  if (insertPositionsInNotion) {
    await insertPositionsToNotion(allPositions);
  }
}

//fetchOrders not supported by Kraken
if (getPositionsFor === "binance") {
  doGetPositions = true;
  doGetTrades = true; //Can I do this?
} else if (getPositionsFor === "kraken") {
  doGetTrades = true;
}

if (doGetTrades) {
  getTrades();
}
if (doGetPositions) getAndSavePositions();
