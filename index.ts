import axios from "axios";
import { Client } from "@notionhq/client";
import * as crypto from "crypto";
import dotenv from "dotenv";
import { getKrakenFromFromPairString } from "./kraken";
import chalk from "chalk";
dotenv.config();

// Kraken API details
const krakenApiKey = process.env.KRAKEN_API_KEY as string;
const krakenApiSecret = process.env.KRAKEN_API_SECRET as string;

// Notion API details
const notionToken = process.env.NOTION_TOKEN as string;
const databaseId = process.env.DATABASE_ID as string;

// Initialize Notion client
const notion = new Client({ auth: notionToken });

// Function to get Kraken signature
function getKrakenSignature(
  path: string,
  request: any,
  secret: string
): string {
  const message = JSON.stringify(request);
  const secret_buffer = Buffer.from(secret, "base64");
  const hash = crypto.createHash("sha256");
  const hmac = crypto.createHmac("sha512", secret_buffer);
  const hash_digest = hash.update(request.nonce + message).digest("binary");
  const hmac_digest = hmac
    .update(path + hash_digest, "binary")
    .digest("base64");

  return hmac_digest;
}

// Function to fetch trades from Kraken
async function fetchKrakenTrades() {
  const path = "/0/private/TradesHistory";
  const nonce = new Date().getTime() * 1000; // nonce as milliseconds
  const headers = {
    "API-Key": krakenApiKey,
    "API-Sign": getKrakenSignature(path, { nonce }, krakenApiSecret),
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(
      `https://api.kraken.com${path}`,
      { nonce },
      { headers }
    );
    console.log("Kraken response:", response.data);
    return response.data.result.trades;
  } catch (error) {
    console.error(chalk.red("Error fetching trades from Kraken:"), error);
    return {};
  }
}
interface Trade {
  ordertxid: string;
  postxid: string;
  pair: string;
  time: number;
  type: string;
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: number;
  margin: string;
  leverage: string;
  misc: string;
  trade_id: number;
}

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

    console.log(`> Checking for tradeID ${tradeID}.`);
    console.log(tradeDetail);
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

    const from = getKrakenFromFromPairString(tradeDetail.pair);
    if (!from) {
      console.error(chalk.red(`Unknown currency pair: ${tradeDetail.pair}`));
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
      //console.error(chalk.red(`Unknown assetSymbol : ${from}`));
      continue;
    }

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

// Main function to execute the process
async function main() {
  const trades = await fetchKrakenTrades();
  await insertTradesToNotion(trades);
}
main();
