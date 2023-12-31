import axios from "axios";
import * as crypto from "crypto";
import { Trade } from "../interfaces/Trade"; // Assuming Trade interface is in index.ts
import chalk from "chalk";
export class Kraken {
  private krakenApiKey: string;
  private krakenApiSecret: string;

  constructor(krakenApiKey: string, krakenApiSecret: string) {
    this.krakenApiKey = krakenApiKey;
    this.krakenApiSecret = krakenApiSecret;
  }

  public async fetchKrakenTrades(): Promise<Record<string, Trade>> {
    const path = "/0/private/TradesHistory";
    const nonce = new Date().getTime() * 1000; // nonce as milliseconds
    const headers = {
      "API-Key": this.krakenApiKey,
      "API-Sign": this.getKrakenSignature(
        path,
        { nonce },
        this.krakenApiSecret
      ),
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.post(
        `https://api.kraken.com${path}`,
        { nonce },
        { headers }
      );
      //console.log("Kraken response:", response.data);
      const tradesWithExchange = response.data.result.trades.map(
        (trade: any) => ({
          ...trade,
          exchange: "Kraken",
        })
      );
      return tradesWithExchange;
    } catch (error) {
      console.error(chalk.red("Error fetching trades from Kraken:"), error);
      return {};
    }
  }

  // Function to get Kraken signature
  private getKrakenSignature(
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
}

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
  ];

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
