import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import chalk from "chalk";
import ccxt from "ccxt";
import { Kraken, getKrakenFromFromPairString } from "./exchanges/Kraken";
import { Trade } from "interfaces/Trade";

dotenv.config();

// Kraken API details
const krakenApiKey = process.env.KRAKEN_API_KEY as string;
const krakenApiSecret = process.env.KRAKEN_API_SECRET as string;

const binanceApiKey = process.env.BINANCE_API_KEY;
const binanceSecret = process.env.BINANCE_API_SECRET;

// Notion API details
const notionToken = process.env.NOTION_TOKEN as string;
const databaseId = process.env.DATABASE_ID as string;

// Initialize Kraken client
const kraken = new Kraken(krakenApiKey, krakenApiSecret);

// Initialize Notion client
const notion = new Client({ auth: notionToken });

async function checkIfTradeExists(tradeID: string): Promise<boolean> {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Trade ID",
        title: {
          equals: tradeID,
        },
      },
    });
    return response.results.length > 0;
  } catch (error) {
    console.error(
      chalk.red(`Error querying Notion database for trade ID ${tradeID}:`),
      error
    );
    return false;
  }
}
// Function to insert trades into Notion
async function insertTradesToNotion(trades: Record<string, Trade>) {
  for (const [tradeID, tradeDetail] of Object.entries(trades)) {
    // Function to query Notion database for a specific Trade ID

    // console.log(`> Checking for tradeID ${tradeID}.`);
    // console.log(tradeDetail);
    const tradeExists = await checkIfTradeExists(tradeID);
    if (tradeExists) {
      console.warn(
        `Trade with ID ${tradeID} already exists in Notion. Skipping.`
      );
      continue;
    } else {
      //   console.log(`Trade doens't exit .`);
    }

    // Ensure the trade details have the necessary properties
    // console.log("tradeID is", tradeID);
    // console.log("tradeDetail is ", tradeDetail);

    if (!tradeDetail || !tradeDetail.pair || !tradeDetail.vol) {
      console.error(
        chalk.red(`Trade details are missing for trade ID: ${tradeID}`)
      );
      continue;
    }

    let from = "";
    if (tradeDetail.exchange === "Kraken") {
      from = getKrakenFromFromPairString(tradeDetail.pair) as string;
      if (!from) {
        console.error(chalk.red(`Unknown currency pair: ${tradeDetail.pair}`));
        continue;
      }
    } else if (tradeDetail.exchange === "Binance") {
      from = tradeDetail.pair.split("/")[0];
    } else {
      console.error(chalk.red(`Unknown exchange: ${tradeDetail.exchange}`));
      continue;
    }

    function translateKrakenSymbol(krakenSymbol: string) {
      const symbolMap: { [key: string]: string } = {
        XETH: "ETH",
        ETH: "ETH",
        XDG: "XDG",
        XXBT: "BTC",
        MATIC: "MATIC",
        ZUSD: "USD",
        ZEUR: "EUR",
        XBT: "BTC",
        QNT: "QNT",
        SOL: "SOL",
        INJ: "INJ",
        USDC: "USDC",
      };
      return symbolMap[krakenSymbol];
    }
    let assetSymbol = translateKrakenSymbol(from);
    if (!assetSymbol) {
      assetSymbol = from;
      console.error(chalk.red(`Unknown assetSymbol : ${from}`));
      //continue;
    }
    console.log("assetSymbol is ", assetSymbol);
    const price = parseFloat(tradeDetail.price);
    if (isNaN(price)) {
      console.error(chalk.red(`Invalid price for trade ID: ${tradeID}`));
      continue;
    }

    console.log(from);
    const tradeTitle = tradeDetail.type + " " + tradeDetail.vol + " " + from;
    const quantityIndex = tradeDetail.type === "buy" ? 1 : -1;
    const quantity = Number(tradeDetail.vol) * quantityIndex;
    const page = {
      parent: { database_id: databaseId },
      properties: {
        Title: { title: [{ text: { content: tradeTitle } }] },
        "Trade ID": { rich_text: [{ text: { content: tradeID } }] }, // Adjusted to rich_text
        Date: {
          date: {
            start: new Date(tradeDetail.time * 1000).toISOString(),
            // If you have an end date, include it as well
            // end: new Date(endTime).toISOString()
          },
        },
        Asset: {
          select: { name: assetSymbol }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Exchange: {
          select: { name: tradeDetail.exchange }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Direction: {
          select: { name: tradeDetail.type }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Quantity: {
          number: quantity,
        },
        Fee: {
          number: Number(tradeDetail.fee),
        },
        Cost: {
          number: Number(tradeDetail.cost),
        },
        Price: {
          number: price,
        },
        // Map other properties as needed
      },
    };

    try {
      await notion.pages.create(page);
    } catch (error) {
      console.error(
        chalk.red(`Error inserting trade ${tradeID} into Notion:`),
        error
      );
    }
    // process.exit()
  }
}
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
