import ccxt from "ccxt";
import dotenv from "dotenv";
import { insertBalanceToNotion, savePortfolioValueToNotion } from "./notion";
import { calculateUsdValues } from "./exchanges/prices";

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

  let portfolioTotalUsdValue = 0;
  const krakenBalance = await fetchBalances(kraken);
  const { balance: updatedKrakenBalance, totalUsdValue: totalUsdValueKraken } =
    await calculateUsdValues(kraken, krakenBalance);
  portfolioTotalUsdValue += totalUsdValueKraken;
  await insertBalanceToNotion(updatedKrakenBalance, "Kraken");

  const bybitBalance = await fetchBalances(bybit);
  const { balance: updatedBybitBalance, totalUsdValue: totalUsdValueBybit } =
    await calculateUsdValues(bybit, bybitBalance);
  portfolioTotalUsdValue += totalUsdValueBybit;
  await insertBalanceToNotion(updatedBybitBalance, "Bybit");

  const binanceBalance = await fetchBalances(binance);
  const {
    balance: updatedBinanceBalance,
    totalUsdValue: totalUsdValueBinance,
  } = await calculateUsdValues(binance, binanceBalance);
  portfolioTotalUsdValue += totalUsdValueBinance;
  await insertBalanceToNotion(updatedBinanceBalance, "Binance");

  savePortfolioValueToNotion(portfolioTotalUsdValue);
}

main();
