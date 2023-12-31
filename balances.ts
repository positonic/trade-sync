import ccxt from "ccxt";
import dotenv from "dotenv";

// Configure dotenv to load the .env file
dotenv.config();

// Function to fetch and display balances from an exchange
async function fetchBalances(exchange: any) {
  try {
    const balance = await exchange.fetchBalance();
    console.log(exchange.id, "balance:", balance);
  } catch (error) {
    console.error(exchange.id, "an error occurred:", error);
  }
}

async function main() {
  // Initialize exchanges with your API keys from .env
  // const bybit = new ccxt.bybit({
  //   apiKey: process.env.BYBIT_API_KEY, // Loaded from .env
  //   secret: process.env.BYBIT_API_SECRET, // Loaded from .env
  // });

  // const binance = new ccxt.binance({
  //   apiKey: process.env.BINANCE_API_KEY, // Loaded from .env
  //   secret: process.env.BINANCE_API_SECRET, // Loaded from .env
  // });

  const kraken = new ccxt.kraken({
    apiKey: process.env.KRAKEN_API_KEY, // Loaded from .env
    secret: process.env.KRAKEN_API_SECRET, // Loaded from .env
  });

  // Fetch and display balances
  //await fetchBalances(bybit);
  // await fetchBalances(binance);
  await fetchBalances(kraken);
}

main();
