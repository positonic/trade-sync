import { Exchange as CCXTExchange, Trade } from "ccxt"; // renaming Exchange from ccxt to CCXTExchange to avoid naming conflict

interface CCxtTrade extends Trade {
  margin?: string;
  leverage?: string;
  misc?: string;
}
// Defining the structure of a normalized trade
interface NormalizedTrade {
  id: string;
  ordertxid: string;
  pair: string;
  time: number;
  type: string;
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: number;
  margin: string;
  leverage: string;
  misc: string;
  exchange: string;
}

export type FetchTradesReturnType = Record<string, NormalizedTrade>;

export default class Exchange {
  protected client: CCXTExchange;

  constructor(
    ccxtInstance: any, // Accepting ccxt instance or class dynamically
    apiKey: string,
    apiSecret: string,
    exchangeId: string
  ) {
    const exchangeClass = ccxtInstance[exchangeId];
    if (!exchangeClass)
      throw new Error(`Exchange ${exchangeId} is not supported`);
    // let config: { apiKey: string; secret: string } = {
    //   apiKey: apiKey,
    //   secret: apiSecret,
    // };
    // config = urls ? { ...config, ...urls } : config;
    // console.log("config", config);
    // this.client = new exchangeClass(config);
    this.client = new exchangeClass({
      apiKey: apiKey,
      secret: apiSecret,
      urls: {
        api: {
          Public: "https://api.binance.com/api/v3/",
          Private: "https://api.binance.com/api/v3/",
        },
      },
    });
  }

  async fetchTrades(
    market: string,
    since: number | undefined = undefined,
    limit: number = 50
  ): Promise<FetchTradesReturnType> {
    try {
      const rawTrades = await this.client.fetchMyTrades(market, since, limit);
      const normalizedTrades = rawTrades.map(
        (trade: CCxtTrade): [string, NormalizedTrade] => {
          const normalizedTrade: NormalizedTrade = {
            id: trade.id?.toString() ?? "",
            ordertxid: trade.order?.toString() ?? "",
            pair: trade.symbol ?? "",
            time: Number(trade.timestamp),
            type: trade.side,
            ordertype: String(trade.type),
            price: trade.price.toString(),
            cost: (trade.cost ?? 0).toString(),
            fee: trade.fee?.cost?.toString() ?? "0",
            vol: Number(trade.amount),
            margin: trade.margin ?? "",
            leverage: trade.leverage ?? "",
            misc: trade.misc ?? "",
            exchange: this.client.name,
          };
          return [normalizedTrade.id, normalizedTrade]; // Ensure the key is a string
        }
      );
      return Object.fromEntries(normalizedTrades);
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return {} as FetchTradesReturnType; // Return an empty Record<string, NormalizedTrade>
    }
  }

  async fetchAllTrades(limit: number = 50): Promise<any> {
    try {
      // Fetch all available markets for the exchange
      const markets = await this.client.loadMarkets();
      const marketSymbols = Object.keys(markets);

      const allTradesPromises = marketSymbols.map((market) =>
        this.fetchTrades(market, undefined, limit)
      );

      const allTradesResults = await Promise.all(allTradesPromises);

      // Combine all trades into one structure or handle them as you see fit
      const combinedTrades: Record<string, FetchTradesReturnType> = {}; // Add index signature

      allTradesResults.forEach((trades, index) => {
        combinedTrades[marketSymbols[index]] = trades;
      });

      return combinedTrades;
    } catch (error) {
      console.error(
        `Error fetching all trades from ${this.client.name}:`,
        error
      );
      return {};
    }
  }
}