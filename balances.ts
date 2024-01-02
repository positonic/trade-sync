import ccxt from "ccxt";
import dotenv from "dotenv";
import { insertBalanceToNotion } from "./notion";

// Configure dotenv to load the .env file
dotenv.config();

// Function to fetch and display balances from an exchange
async function fetchBalances(exchange: any) {
  try {
    const balance = await exchange.fetchBalance();
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

  // Fetch and display balances
  //await fetchBalances(bybit);
  // await fetchBalances(binance);

  //const exchangeId: keyof ccxt.ExchangeId = "kraken"; // Example: 'kraken'

  const krakenBalance = await fetchBalances(kraken);
  await insertBalanceToNotion(krakenBalance, "Kraken");

  const bybitBalance = await fetchBalances(bybit);
  await insertBalanceToNotion(bybitBalance, "Bybit");

  const binanceBalance = await fetchBalances(binance);
  await insertBalanceToNotion(binanceBalance, "Binance");
}

main();
