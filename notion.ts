import { Client } from "@notionhq/client";
import chalk from "chalk";
import { getKrakenFromFromPairString } from "./exchanges/Kraken";
import { Balance } from "./interfaces/Balance";
import dotenv from "dotenv";
import { FetchTradesReturnType } from "./exchanges/Exchange";
// Configure dotenv to load the .env file
dotenv.config();

// Notion API details
const notionToken = process.env.NOTION_TOKEN as string;
const tradesDatabaseId = process.env.NOTION_TRADES_DATABASE_ID as string;
const balancesDatabaseId = process.env.NOTION_BALANCES_DATABASE_ID as string;
const portfolioValueDatabaseId = process.env
  .NOTION_PORTFOLIO_VALUE_DATABASE_ID as string;

// Initialize Notion client
const notion = new Client({ auth: notionToken });

async function checkIfTradeExists(tradeID: string): Promise<boolean> {
  try {
    const response = await notion.databases.query({
      database_id: tradesDatabaseId,
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

async function checkIfBalanceExists(exchangeMarket: string) {
  const response = await notion.databases.query({
    database_id: balancesDatabaseId,
    filter: {
      property: "ExchangeMarket",
      title: {
        equals: exchangeMarket,
      },
    },
  });

  return response.results.length > 0 ? response.results[0] : null;
}
// Define a function to insert data into Notion database
export async function insertOrUpdateBalanceToNotion(
  balance: Balance,
  exchange: string,
  exchangeMarket: string
) {
  const existingBalance = await checkIfBalanceExists(exchangeMarket);
  const usdValueTime = new Date();

  // Loop through each currency in the balance and create pages or update the database as necessary
  for (const [currency, data] of Object.entries(balance.total ?? {}).filter(
    ([_, value]) => value !== undefined
  )) {
    const free = (balance.free as unknown as { [key: string]: number })[
      currency
    ];
    const used = (balance.used as unknown as { [key: string]: number })[
      currency
    ];
    const usdValue = balance.usdValue ? balance.usdValue[currency] || 0 : 0;

    if (free > 0 || used > 0 || data > 0) {
      const balanceProperties = {
        ExchangeMarket: {
          title: [
            {
              text: {
                content: exchangeMarket,
              },
            },
          ],
        },
        Free: {
          number: free || 0,
        },
        Used: {
          number: used || 0,
        },
        Total: {
          number: data || 0,
        },
        Exchange: {
          select: { name: exchange }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Coin: {
          rich_text: [{ text: { content: currency } }], // Assuming 'type' is either 'buy' or 'sell'
        },
        USDValue: {
          number: usdValue,
        },
        USDPrice: {
          number: usdValue / data || 0, // Assuming this is what you mean by usdPrice
        },
        USDValueTime: {
          date: {
            start: usdValueTime.toISOString(),
          },
        },
      };
      if (existingBalance) {
        // Update the existing balance
        await notion.pages.update({
          page_id: existingBalance.id,
          properties: balanceProperties,
        });
      } else {
        await notion.pages.create({
          parent: { database_id: balancesDatabaseId },
          properties: balanceProperties,
        });
      }
    }
  }
}

// Function to insert trades into Notion
export async function insertTradesToNotion(trades: FetchTradesReturnType) {
  for (const [tradeID, tradeDetail] of Object.entries(trades)) {
    // Function to query Notion database for a specific Trade ID

    const tradeExists = await checkIfTradeExists(tradeID);
    if (tradeExists) {
      console.warn(
        `Trade with ID ${tradeID} already exists in Notion. Skipping.`
      );
      continue;
    }

    // Ensure the trade details have the necessary properties
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
        BTC: "BTC",
      };
      return symbolMap[krakenSymbol];
    }
    let assetSymbol = translateKrakenSymbol(from);
    if (!assetSymbol) {
      assetSymbol = from;
      console.error(chalk.red(`Unknown assetSymbol : ${from}`));
      //continue;
    }

    const price = parseFloat(tradeDetail.price);
    if (isNaN(price)) {
      console.error(chalk.red(`Invalid price for trade ID: ${tradeID}`));
      continue;
    }

    const tradeTitle = tradeDetail.type + " " + tradeDetail.vol + " " + from;
    const quantityIndex = tradeDetail.type === "buy" ? 1 : -1;
    const quantity = Number(tradeDetail.vol) * quantityIndex;

    const page = {
      parent: { database_id: tradesDatabaseId },
      properties: {
        Title: { title: [{ text: { content: tradeTitle } }] },
        "Trade ID": { rich_text: [{ text: { content: tradeID } }] }, // Adjusted to rich_text
        Date: {
          date: {
            start: new Date(tradeDetail.time).toISOString(),
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
        Market: {
          // Adding the Market column
          rich_text: [{ text: { content: tradeDetail.pair } }],
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
export async function savePortfolioValueToNotion(value: number) {
  const currentDate = new Date().toISOString();

  await notion.pages.create({
    parent: { database_id: portfolioValueDatabaseId },
    properties: {
      Name: {
        title: [
          {
            text: { content: "Total Portfolio Value" },
          },
        ],
      },
      Value: {
        number: value,
      },
      Date: {
        date: { start: currentDate },
      },
    },
  });
}
