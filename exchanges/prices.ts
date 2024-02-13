import { Balance } from "interfaces/Balance";
import Exchange from "interfaces/Exchange";

export async function calculateUsdValues(
  exchange: Exchange,
  balance: Balance
): Promise<{
  balance: Balance;
  totalUsdValue: number;
}> {
  const markets = await exchange.instance.loadMarkets();
  let totalUsdValue = 0; // Initialize total USD value

  balance.usdValue = {}; // Initialize usdValue

  for (const [currency, totalAmount] of Object.entries(balance.total)) {
    //console.log(`currency is ${currency}`);

    if (currency === "USD" || currency === "USDT" || currency === "USDC") {
      // totalUsdValue += totalAmount;
      balance.usdValue[currency] = totalAmount;
      continue;
    }

    if (totalAmount <= 0) continue;

    const usdMarketSymbol = `${currency}/USD`;
    const usdtMarketSymbol = `${currency}/USDT`;

    const usdMarketExists = usdMarketSymbol in markets;
    const usdtMarketExists = usdtMarketSymbol in markets;

    //console.log("markets are:", markets);
    const marketExists = usdMarketExists
      ? usdMarketExists
      : usdtMarketExists
      ? usdtMarketExists
      : false;
    const marketSymbol = usdMarketExists
      ? usdMarketSymbol
      : usdtMarketExists
      ? usdtMarketSymbol
      : "";
    //if (marketSymbol !== "BEAM/USDT") continue;
    // console.log("marketSymbol", marketSymbol);
    // console.log(`Market exists: ${marketExists}`);
    // console.log(`Market usdtMarketExists exists: ${usdtMarketExists}`);

    if (marketExists) {
      try {
        const ticker = await exchange.instance.fetchTicker(marketSymbol);
        const currencyValue = totalAmount * ticker.last; // Calculate USD value
        if (currencyValue > 3) {
          balance.usdValue[currency] = currencyValue; // Assign USD value
          totalUsdValue += currencyValue; // Add to total
        }
      } catch (error) {
        console.error(`Error fetching ticker for ${marketSymbol}:`, error);
      }
    }
  }

  return { balance, totalUsdValue }; // Return the modified balance and total USD value
}
