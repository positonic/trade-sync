import ccxt from "ccxt";
import dotenv from "dotenv";
import {
  insertOrUpdateBalanceToNotion,
  savePortfolioValueToNotion,
} from "./notion";
import { calculateUsdValues } from "./exchanges/prices";
import Exchange from "interfaces/Exchange";

// Configure dotenv to load the .env file
dotenv.config();

// Function to fetch and display balances from an exchange
async function fetchBalances(exchange: any, config: any) {
  try {
    const balance = await exchange.fetchBalance(config);
    return balance;
  } catch (error) {
    console.error(exchange.id, "an error occurred:", error);
  }
}

async function main() {
  // Initialize exchanges with your API keys from .env
  const bybit = new ccxt.bybit({
    apiKey: process.env.BYBIT_API_KEY, // Loaded from .env
    secret: process.env.BYBIT_API_SECRET, // Loaded from .env
  });

  const binance = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY, // Loaded from .env
    secret: process.env.BINANCE_API_SECRET, // Loaded from .env
  });

  const kraken = new ccxt.kraken({
    apiKey: process.env.KRAKEN_API_KEY, // Loaded from .env
    secret: process.env.KRAKEN_API_SECRET, // Loaded from .env
  });

  // Define an array of exchanges with their respective names and instances
  const exchanges: Exchange[] = [
    { name: "Kraken", instance: kraken, fetchConfig: {} },
    { name: "Bybit", instance: bybit, fetchConfig: { type: "spot" } },
    { name: "Binance", instance: binance, fetchConfig: {} },
  ];

  let portfolioTotalUsdValue = 0;

  for (const exchange of exchanges) {
    try {
      // Fetch balances for each exchange
      const balance = await fetchBalances(
        exchange.instance,
        exchange.fetchConfig
      );
      //console.log("balance", balance);
      // Calculate USD values for the fetched balances
      const { balance: updatedBalance, totalUsdValue } =
        await calculateUsdValues(exchange, balance);

      // Accumulate the total USD value from all exchanges
      portfolioTotalUsdValue += totalUsdValue;

      console.log(
        "updatedBalance.usdValue: ",
        "For: " + exchange.name,
        updatedBalance.usdValue
      );
      //Insert the updated balance and total USD value into Notion
      await insertOrUpdateBalanceToNotion(updatedBalance, exchange.name);

      // Log a success message
      console.log(
        `${exchange.name} exchange processed successfully. Total USD Value: ${totalUsdValue}`
      );
      console.log(" ");
      console.log("________________\n\n");
    } catch (error) {
      // Log the error for the specific exchange
      console.error(`Error processing ${exchange.name} exchange:`, error);
    }
  }

  // After the loop, portfolioTotalUsdValue contains the total value from all exchanges
  console.log("Total Portfolio Value in USD:", portfolioTotalUsdValue);

  savePortfolioValueToNotion(portfolioTotalUsdValue);
}

main();
