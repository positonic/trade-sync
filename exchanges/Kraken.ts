interface CurrencyPair {
  from: string;
  to: string;
}

export function getKrakenFromFromPairString(pair: string): string | null {
  const from = parseKrakenPair(pair)?.from;

  if (!from) {
    console.error(`Unknown currency pair: ${pair}, From was ${from}`);
    return null;
  } else {
    return from;
  }
}

export function parseKrakenPair(pair: string): CurrencyPair | null {
  // Define known currency codes
  const currencyCodes = [
    "XETH",
    "XXBT",
    "MATIC",
    "ZUSD",
    "ZEUR",
    "XBT",
    "USDC",
    "ETH",
    "XBT",
    "XXBTZ",
    "XDG",
    "USD",
    "QNT",
    "SOL",
    "AKT",
    "NEAR",
    "INJ",
    "BTC",
    "USDT",
  ];

  if (pair.includes("/")) {
    const [from, to] = pair.split("/");
    if (currencyCodes.includes(from) && currencyCodes.includes(to)) {
      return { from, to };
    } else {
      console.error(`Unknown currency pair: ${pair}`);
      return null;
    }
  }

  for (const code of currencyCodes) {
    if (pair.startsWith(code)) {
      const from = code;
      const to = pair.replace(code, "");
      if (currencyCodes.includes(to)) {
        return { from, to };
      }
    }
  }

  console.error(`Unknown currency pair: ${pair}`);
  return null;
}

// Example usage
// const pairs = ['XETHZUSD', 'XXBTZEUR', 'XXBTZUSD', 'MATICUSD'];
// pairs.forEach(pair => {
//     const result = parseKrakenPair(pair);
//     console.log(`Pair: ${pair}, Result:`, result);
// });
// It also works with console.log(getKrakenFromFromPairString("BTC/USDT"));
