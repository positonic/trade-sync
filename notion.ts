import { Client } from "@notionhq/client";
import chalk from "chalk";
import { getKrakenFromFromPairString } from "./exchanges/Kraken";
import { Balance } from "./interfaces/Balance";
import dotenv from "dotenv";
import { NormalizedTrade, Position } from "./exchanges/Exchange";

const NOTION_KRAKEN_PAGE_ID = "096d3430c8b44b1899978367a3e89b0f";
const NOTION_BINANCE_PAGE_ID = "c3695a15f2134308b6f5debe3576a85a";
const NOTION_BYBIT_PAGE_ID = "05f5363c6b494f7b8b5d1f9650024016";
//type Exchange = "kraken" | "binance" | "bybit";
const exchangePages: any = {
  Kraken: NOTION_KRAKEN_PAGE_ID,
  Binance: NOTION_BINANCE_PAGE_ID,
  Bybit: NOTION_BYBIT_PAGE_ID,
};

// Configure dotenv to load the .env file
dotenv.config();

// Notion API details
const notionToken = process.env.NOTION_TOKEN as string;
const tradesDatabaseId = process.env.NOTION_TRADES_DATABASE_ID as string;
const positionsDatabaseId = process.env.NOTION_POSITIONS_DATABASE_ID as string;
const balancesDatabaseId = process.env.NOTION_BALANCES_DATABASE_ID as string;
const portfolioValueDatabaseId = process.env
  .NOTION_PORTFOLIO_VALUE_DATABASE_ID as string;

// Initialize Notion client
const notion = new Client({ auth: notionToken });

async function checkIfItemExists(
  databaseId: string,
  columnName: string,
  value: string
): Promise<boolean> {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: columnName,
        title: {
          equals: value,
        },
      },
    });
    return response.results.length > 0;
  } catch (error) {
    console.error(
      chalk.red(`Error querying Notion database for ${columnName} ${value}:`),
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

function getFrom(exchange: string, pair: string) {
  let from = "";
  if (exchange.toLowerCase() === "kraken") {
    from = getKrakenFromFromPairString(pair) as string;
    if (!from) {
      console.error(chalk.red(`Unknown currency pair: ${pair}: in getFrom`));
    }
  } else if (exchange.toLowerCase() === "binance") {
    from = pair.split("/")[0];
  } else {
    console.error(chalk.red(`Unknown exchange: ${exchange}`));
    process.exit();
  }
  return from;
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
    ARB: "ARB",
    TIA: "TIA",
    BLUR: "BLUR",
  };

  // Check if the key exists in the map
  if (krakenSymbol in symbolMap) {
    return symbolMap[krakenSymbol];
  } else {
    // If the key does not exist, return the key itself
    return krakenSymbol;
  }
}
// Define a function to insert data into Notion database
export async function insertOrUpdateBalanceToNotion(
  balance: Balance,
  exchange: string
) {
  const exchangePage: string = exchangePages[exchange];

  //console.log("exchangeBalance", exchange, balance);
  // Loop through each currency in the balance and create pages or update the database as necessary
  for (const [currency, data] of Object.entries(balance.total ?? {}).filter(
    ([_, value]) => value !== undefined
  )) {
    const exchangeMarket = exchange + ":" + currency;
    const usdValueTime = new Date();
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
          select: { name: currency },
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
        ExchangePage: {
          relation: [
            {
              id: exchangePage,
            },
          ],
        },
      };
      const existingBalance = await checkIfBalanceExists(exchangeMarket);

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
export async function insertTradesToNotion(trades: NormalizedTrade[]) {
  console.log(`Debug: ${trades.length} trades passed to Notion`);
  let insertedTrades = 0;
  //console.log(`Inserting ${trades} into Notion...`);
  for (const tradeDetail of trades) {
    // Function to query Notion database for a specific Trade ID
    const tradeExists = await checkIfItemExists(
      tradesDatabaseId,
      "Trade ID",
      tradeDetail.id
    );
    if (tradeExists) {
      console.warn(
        `Trade with ID ${tradeDetail.id} already exists in Notion. Skipping.`
      );
      continue;
    }

    // Ensure the trade details have the necessary properties
    if (!tradeDetail || !tradeDetail.pair || !tradeDetail.vol) {
      console.error(
        chalk.red(`Trade details are missing for trade ID: ${tradeDetail.id}`)
      );
      continue;
    }

    let from = getFrom(tradeDetail.exchange, tradeDetail.pair);

    let assetSymbol = translateKrakenSymbol(from);
    if (!assetSymbol) {
      assetSymbol = from;
      console.error(chalk.red(`Unknown assetSymbol : ${from}`));
      //continue;
    }

    const price = parseFloat(tradeDetail.price);
    if (isNaN(price)) {
      console.error(chalk.red(`Invalid price for trade ID: ${tradeDetail.id}`));
      continue;
    }

    const tradeTitle = tradeDetail.type + " " + tradeDetail.vol + " " + from;
    const quantityIndex = tradeDetail.type === "buy" ? 1 : -1;
    const quantity = Number(tradeDetail.vol) * quantityIndex;

    const page = {
      parent: { database_id: tradesDatabaseId },
      properties: {
        Title: { title: [{ text: { content: tradeTitle } }] },
        "Trade ID": { rich_text: [{ text: { content: tradeDetail.id } }] }, // Adjusted to rich_text
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
        "Price $": {
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
      insertedTrades++;
    } catch (error) {
      console.error(
        chalk.red(`Error inserting trade ${tradeDetail.id} into Notion:`),
        error
      );
    }
    // process.exit()
  }
  console.log(`Inserted ${insertedTrades} trades into Notion.`);
}

// Function to insert trades into Notion
export async function insertPositionsToNotion(positions: Position[]) {
  console.log(`Inserting ${positions.length} positions into notion`);
  let insertedPositions = 0;
  //console.log(`Inserting ${trades} into Notion...`);
  for (const position of positions) {
    // Function to query Notion database for a specific Trade ID
    const positionId = position.time + "-" + position.pair;
    const tradeExists = await checkIfItemExists(
      positionsDatabaseId,
      "Position ID",
      positionId
    );
    if (tradeExists) {
      console.warn(
        `Trade with ID ${positionId} already exists in Notion. Skipping.`
      );
      continue;
    }

    // Ensure the trade details have the necessary properties
    if (!position || !position.pair) {
      // || !position.vol
      console.error(
        chalk.red(`Trade details are missing for trade ID: ${positionId}`)
      );
      continue;
    }

    let from = getFrom(position.exchange, position.pair);

    let assetSymbol = translateKrakenSymbol(from);
    if (!assetSymbol) {
      assetSymbol = from;
      console.error(chalk.red(`Unknown assetSymbol : ${from}`));
      //continue;
    }

    const price = position.price;
    if (isNaN(price)) {
      console.error(chalk.red(`Invalid price for trade ID: ${positionId}`));
      continue;
    }
    const positionTitle = position.type + " " + position.quantity + " " + from;

    const page = {
      parent: { database_id: positionsDatabaseId },
      properties: {
        Title: { title: [{ text: { content: positionTitle } }] },
        "Position ID": { rich_text: [{ text: { content: positionId } }] }, // Adjusted to rich_text
        Date: {
          date: {
            start: new Date(position.time).toISOString(),
            // If you have an end date, include it as well
            // end: new Date(endTime).toISOString()
          },
        },
        Type: {
          select: { name: position.type }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Status: {
          select: { name: "closed" }, // Assuming 'type' is either 'buy' or 'sell'
        },
        PositionExchange: {
          select: { name: position.exchange }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Crypto: {
          select: { name: from }, // Assuming 'type' is either 'buy' or 'sell'
        },
        Quantity: {
          number: position.quantity,
        },
        BuyCost: {
          number: position.buyCost,
        },
        SellCost: {
          number: position.sellCost,
        },
        Price: {
          number: position.price,
        },
        ProfitLoss: {
          number: position.profitLoss,
        },
        DurationMinutes: {
          number: position.duration,
        },
        Exchange: {
          select: {
            name:
              position.exchange.charAt(0).toUpperCase() +
              position.exchange.slice(1),
          },
        },
        // Market: {
        //   // Adding the Market column
        //   rich_text: [{ text: { content: tradeDetail.pair } }],
        // },
        // Map other properties as needed
      },
    };

    try {
      await notion.pages.create(page);
      insertedPositions++;
    } catch (error) {
      console.error(
        chalk.red(`Error inserting trade ${positionId} into Notion:`),
        error
      );
    }
    // process.exit()
  }
  console.log(`Inserted ${insertedPositions} positions into Notion.`);
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

export async function getLastTradeTimestamp(): Promise<number> {
  const response = await notion.databases.query({
    database_id: tradesDatabaseId,
    sorts: [
      {
        property: "Date",
        direction: "descending",
      },
    ],
    page_size: 1,
  });

  if (response.results.length > 0) {
    const lastTrade = response.results[0] as any; // Using 'any' for simplicity

    // Assuming 'Date' is the property name of the timestamp in your Notion database
    const timestamp = new Date(lastTrade.properties.Date.date.start).getTime();
    return timestamp;
  }

  return 0; // Default to epoch start if no trades are found
}
