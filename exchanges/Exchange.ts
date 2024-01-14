import { Exchange as CCXTExchange, Trade } from "ccxt"; // renaming Exchange from ccxt to CCXTExchange to avoid naming conflict

interface CCxtTrade extends Trade {
  margin?: string;
  leverage?: string;
  misc?: string;
}
// Defining the structure of a normalized trade
export interface NormalizedTrade {
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
// Define the interface for the Trade array
export type FetchTradesReturnType = Record<string, NormalizedTrade>;

// Interface for the aggregated order
export interface AggregatedOrder {
  ordertxid: string;
  time: number; // The time the trade position was opened
  date: Date;
  type: "buy" | "sell";
  pair: string;
  totalVol: number;
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  exchange: string;
  trades: NormalizedTrade[]; // Add an array of trades
}
export interface Position {
  time: number; // The time the trade position was opened
  date: Date;
  positionType: "long" | "short"; // New property to indicate the position type
  buyCost: number; // Total cost of buy orders
  sellCost: number; // Total cost of sell orders
  profitLoss: number; // Profit or loss from the position
  orders: AggregatedOrder[]; // Array of orders that make up the position
  pair: string;
  price: number;
}
export function aggregateTrades(trades: NormalizedTrade[]): AggregatedOrder[] {
  const ordersMap: { [ordertxid: string]: AggregatedOrder } = {};

  trades.forEach((trade) => {
    if (!ordersMap[trade.ordertxid]) {
      // Initialize a new order with the current trade
      ordersMap[trade.ordertxid] = {
        ordertxid: trade.ordertxid,
        time: trade.time,
        date: new Date(trade.time),
        type: trade.type as "buy" | "sell",
        pair: trade.pair,
        totalVol: trade.vol,
        highestPrice: parseFloat(trade.price),
        lowestPrice: parseFloat(trade.price),
        averagePrice: parseFloat(trade.price),
        exchange: trade.exchange,
        trades: [trade], // Initialize with the current trade
      };
    } else {
      // Update existing order
      const order = ordersMap[trade.ordertxid];
      order.trades.push(trade); // Add the current trade to the trades array
      order.totalVol += trade.vol;
      order.highestPrice = Math.max(
        order.highestPrice,
        parseFloat(trade.price)
      );
      order.lowestPrice = Math.min(order.lowestPrice, parseFloat(trade.price));
      // Update average price
      order.averagePrice =
        (order.averagePrice * (order.totalVol - trade.vol) +
          parseFloat(trade.price) * trade.vol) /
        order.totalVol;
    }
  });

  return Object.values(ordersMap);
}
export function aggregatePositions(orders: AggregatedOrder[]): Position[] {
  // Group orders by pair
  const ordersByPair: { [pair: string]: AggregatedOrder[] } = {};
  orders.forEach((order) => {
    if (!ordersByPair[order.pair]) {
      ordersByPair[order.pair] = [];
    }
    ordersByPair[order.pair].push(order);
  });

  const positions: Position[] = [];

  // Process each pair
  Object.keys(ordersByPair).forEach((pair) => {
    console.log("pair", pair);
    let buyVolume = 0,
      sellVolume = 0;
    let buyCost = 0,
      sellCost = 0;
    let tempOrders: AggregatedOrder[] = [];

    ordersByPair[pair].forEach((order) => {
      console.log("ordersByPair pair", pair);
      // Accumulate volumes and costs
      if (order.type === "buy") {
        buyVolume += order.totalVol;
        buyCost += order.totalVol * order.averagePrice;
      } else {
        sellVolume += order.totalVol;
        sellCost += order.totalVol * order.averagePrice;
      }

      tempOrders.push(order);
      console.log("tempOrders", tempOrders);
      const VOLUME_THRESHOLD_PERCENT = 2;
      function isVolumeDifferenceWithinThreshold(
        buyVolume: number,
        sellVolume: number
      ) {
        return (
          (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) *
            100 <=
          VOLUME_THRESHOLD_PERCENT
        );
      }
      // Check if buy and sell volumes match
      if (isVolumeDifferenceWithinThreshold(buyVolume, sellVolume)) {
        // Create a position when buy and sell volumes are equal
        const positionType: "long" | "short" =
          buyVolume > sellVolume ? "long" : "short";
        const profitLoss =
          positionType === "long" ? sellCost - buyCost : buyCost - sellCost;
        positions.push({
          time: tempOrders[0].trades[0].time,
          date: new Date(tempOrders[0].trades[0].time),
          price: Number(tempOrders[0].trades[0].price),
          positionType,
          buyCost,
          sellCost,
          profitLoss,
          orders: tempOrders.slice(),
          pair: tempOrders[0].pair,
        });

        // Reset for the next set of matching orders
        buyVolume = 0;
        sellVolume = 0;
        buyCost = 0;
        sellCost = 0;
        tempOrders = [];
      }
    });
  });

  return positions;
}

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
    limit: number = 1000
  ): Promise<FetchTradesReturnType> {
    try {
      if (since) console.log("Call fetchTrades since ", new Date(since));
      const rawTrades = await this.client.fetchMyTrades(
        market,
        since ? since : undefined,
        limit
      );
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

  async fetchAllTrades(
    market: string,
    since: number | undefined
  ): Promise<FetchTradesReturnType> {
    let allTrades: FetchTradesReturnType = {};
    // let since: number | undefined = undefined;
    const limit: number = 100; // Adjust as needed

    while (true) {
      const sinceDate = since ? since * 1000 : undefined;
      console.log("Calling fetchAllTrades", { market, sinceDate, limit });
      const trades = await this.fetchTrades(market, since, limit);
      console.log("Called fetchAllTrades", { trades, since, limit });
      Object.keys(trades).length;
      if (Object.keys(trades).length === 0) {
        break;
      }
      for (const trade of Object.values(trades)) {
        // Assuming each trade has a unique ID and can be normalized to the NormalizedTrade structure
        allTrades[trade.id] = trade;
      }
      const lastTrade: NormalizedTrade =
        Object.values(trades)[Object.values(trades).length - 1];
      since = lastTrade.time + 1;
    }
    console.log("allTrades", allTrades);
    return allTrades;
  }

  async fetchAllMarketsTrades(
    limit: number = 50
  ): Promise<FetchTradesReturnType> {
    try {
      // Fetch all available markets for the exchange
      const markets = await this.client.loadMarkets();
      const marketSymbols = Object.keys(markets);

      const allTradesPromises = marketSymbols.map((market) =>
        this.fetchTrades(market, undefined, limit)
      );

      console.log("allTradesPromises.length", allTradesPromises.length);
      const allTradesResults = await Promise.all(allTradesPromises);

      // Combine all trades into one structure or handle them as you see fit
      const combinedTrades: FetchTradesReturnType = {}; // Update the type to Record<string, FetchTradesReturnType>

      allTradesResults.forEach((trades) => {
        for (const [id, trade] of Object.entries(trades)) {
          combinedTrades[id] = trade; // Flatten the structure by directly assigning trades
        }
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
