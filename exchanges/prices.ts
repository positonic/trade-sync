import { Balance } from "interfaces/Balance";
import Exchange from "interfaces/Exchange";

export async function calculateUsdValues(
  exchange: Exchange,
  balance: Balance
): Promise<{
  balance: Balance;
  totalUsdValue: number;
  exchangeMarket: string;
}> {
  const markets = await exchange.instance.loadMarkets();
  let exchangeMarket = "";
  let totalUsdValue = 0; // Initialize total USD value

  balance.usdValue = {}; // Initialize usdValue

  for (const [currency, totalAmount] of Object.entries(balance.total)) {
    if (currency === "USD" || currency === "USDT" || currency === "USDC") {
      totalUsdValue += totalAmount;
      continue;
    }

    if (totalAmount <= 0) continue;

    const marketSymbol = `${currency}/USD`;
    exchangeMarket = `${exchange.name}-${currency}`;
    const marketExists = marketSymbol in markets;

    if (marketExists) {
      try {
        const ticker = await exchange.instance.fetchTicker(marketSymbol);
        const currencyValue = totalAmount * ticker.last; // Calculate USD value
        balance.usdValue[currency] = currencyValue; // Assign USD value
        totalUsdValue += currencyValue; // Add to total
      } catch (error) {
        console.error(`Error fetching ticker for ${marketSymbol}:`, error);
      }
    }
  }

  return { balance, totalUsdValue, exchangeMarket }; // Return the modified balance and total USD value
}
