import { Exchange as CCXTExchange, Trade } from "ccxt"; // renaming Exchange from ccxt to CCXTExchange to avoid naming conflict

const VOLUME_THRESHOLD_PERCENT = 3;
interface CCxtTrade extends Trade {
  margin?: string;
  leverage?: string;
  misc?: string;
}
// function logArrayAndNestedOrders(objectName: string, array: any) {
//   console.log("Positions:");
//   for (let i = 0; i < array.length; i++) {
//     const obj = array[i];
//     console.log(objectName + i + 1 + ":", obj);

//     // if (obj.orders && Array.isArray(obj.orders)) {
//     //   console.log("Nested Orders:");
//     //   for (let j = 0; j < obj.orders.length; j++) {
//     //     console.log(obj.orders[j]);
//     //   }
//     // }
//   }
// }

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
  ordertxid?: string;
  time: number; // The time the trade position was opened
  date: Date;
  type: "buy" | "sell";
  pair: string;
  amount: number;
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  exchange: string;
  trades: NormalizedTrade[]; // Add an array of trades
  orderId?: string;
  status?: string;
  totalCost: number;
}
export interface Position {
  time: number; // The time the trade position was opened
  date: Date;
  type: "long" | "short"; // New property to indicate the position type
  buyCost: number; // Total cost of buy orders
  sellCost: number; // Total cost of sell orders
  profitLoss: number; // Profit or loss from the position
  orders: AggregatedOrder[]; // Array of orders that make up the position
  pair: string;
  exchange: string;
  price: number;
  quantity: number;
  duration: number; // in hours
  lastTime?: number;
}
export function aggregateTrades(trades: NormalizedTrade[]): AggregatedOrder[] {
  const ordersMap: { [ordertxid: string]: AggregatedOrder } = {};

  trades.forEach((trade) => {
    const price = parseFloat(trade.price);
    const vol = trade.vol;

    if (!ordersMap[trade.ordertxid]) {
      // Initialize a new order with the current trade
      ordersMap[trade.ordertxid] = {
        ordertxid: trade.ordertxid,
        time: trade.time,
        date: new Date(trade.time),
        type: trade.type as "buy" | "sell",
        pair: trade.pair,
        amount: vol,
        highestPrice: price,
        lowestPrice: price,
        averagePrice: price,
        totalCost: price * vol, // Initialize total cost for average price calculation
        exchange: trade.exchange,
        trades: [trade], // Initialize with the current trade
      };
    } else {
      // Update existing order
      const order = ordersMap[trade.ordertxid];
      order.trades.push(trade); // Add the current trade to the trades array
      order.amount += vol;
      order.highestPrice = Math.max(order.highestPrice, price);
      order.lowestPrice = Math.min(order.lowestPrice, price);

      // Update total cost and recalculate average price
      order.totalCost += price * vol;
      order.averagePrice = order.totalCost / order.amount;
    }
  });

  // Return the aggregated orders, removing the totalCost from the final objects
  return Object.values(ordersMap).map((order) => {
    const { totalCost, ...rest } = order;
    return { totalCost, ...rest };
  });
}

export function mapToAggregatedOrders(data: any) {
  const aggregatedOrders: AggregatedOrder[] = [];

  data.forEach((order: any) => {
    const aggregatedOrder: AggregatedOrder = {
      orderId: order.id,
      time: order.timestamp,
      date: new Date(order.datetime),
      type: order.side === "sell" ? "sell" : "buy",
      pair: order.symbol,
      highestPrice: parseFloat(order.price),
      lowestPrice: parseFloat(order.price),
      averagePrice: parseFloat(order.average),
      exchange: order.symbol.split("/")[1],
      amount: parseFloat(order.amount),
      trades: [],
      status: order.status,
      totalCost: parseFloat(order.average) / parseFloat(order.amount),
    };

    aggregatedOrders.push(aggregatedOrder);
  });

  return aggregatedOrders;
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
  const pairOrders = Object.keys(ordersByPair);

  // Process each pair
  pairOrders.forEach((pair) => {
    console.log("pair", pair);
    let buyVolume = 0,
      sellVolume = 0;
    let buyCost = 0,
      sellCost = 0;
    let tempOrders: AggregatedOrder[] = [];

    ordersByPair[pair].forEach((order: AggregatedOrder) => {
      console.log("ordersByPair pair", pair);
      // Accumulate volumes and costs
      if (order.type === "buy") {
        buyVolume += order.amount;
        buyCost += order.amount * order.averagePrice;
      } else {
        sellVolume += order.amount;
        sellCost += order.amount * order.averagePrice;
      }

      console.log(buyVolume);
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
        const quantity = buyVolume > sellVolume ? buyVolume : sellVolume;
        const profitLoss =
          positionType === "long" ? sellCost - buyCost : buyCost - sellCost;
        const duration =
          tempOrders[0].time - tempOrders[tempOrders.length - 1].time;
        positions.push({
          time: tempOrders[0].trades[0].time,
          date: new Date(tempOrders[0].trades[0].time),
          price: Number(tempOrders[0].trades[0].price),
          type: positionType,
          buyCost,
          sellCost,
          profitLoss,
          exchange: tempOrders[0].trades[0].exchange,
          orders: tempOrders.slice(),
          pair: tempOrders[0].pair,
          quantity,
          duration,
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
// function createPositionsFromOrdersOLD(orders: AggregatedOrder[]) {
//   let positions: Position[] = [];

//   let buyVolume = 0,
//     sellVolume = 0;
//   let buyCost = 0,
//     sellCost = 0;
//   let tempOrders: AggregatedOrder[] = [];

//   orders.forEach((order: AggregatedOrder) => {
//     // Accumulate volumes and costs
//     if (order.type === "buy") {
//       buyVolume += order.amount;
//       buyCost += order.amount * order.averagePrice;
//     } else {
//       sellVolume += order.amount;
//       sellCost += order.amount * order.averagePrice;
//     }

//     console.log(buyVolume);
//     tempOrders.push(order);
//     console.log("tempOrders", tempOrders);
//     const VOLUME_THRESHOLD_PERCENT = 2;
//     function isVolumeDifferenceWithinThreshold(
//       buyVolume: number,
//       sellVolume: number
//     ) {
//       return (
//         (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) *
//           100 <=
//         VOLUME_THRESHOLD_PERCENT
//       );
//     }
//     // Check if buy and sell volumes match
//     if (isVolumeDifferenceWithinThreshold(buyVolume, sellVolume)) {
//       // Create a position when buy and sell volumes are equal
//       const positionType: "long" | "short" =
//         buyVolume > sellVolume ? "long" : "short";
//       const quantity = buyVolume > sellVolume ? buyVolume : sellVolume;
//       const profitLoss =
//         positionType === "long" ? sellCost - buyCost : buyCost - sellCost;
//       positions.push({
//         time: tempOrders[0].trades[0].time,
//         date: new Date(tempOrders[0].trades[0].time),
//         price: Number(tempOrders[0].trades[0].price),
//         type: positionType,
//         buyCost,
//         sellCost,
//         profitLoss,
//         exchange: tempOrders[0].trades[0].exchange,
//         orders: tempOrders.slice(),
//         pair: tempOrders[0].pair,
//         quantity,
//       });

//       // Reset for the next set of matching orders
//       buyVolume = 0;
//       sellVolume = 0;
//       buyCost = 0;
//       sellCost = 0;
//       tempOrders = [];
//     }
//   });
//   return positions;
// }
function minutesBetweenTimestamps(
  timestamp1: number,
  timestamp2: number
): number {
  const ts1 = timestamp1;
  const ts2 = timestamp2;

  // Calculate the difference in milliseconds
  const diffInMilliseconds = Math.abs(ts1 - ts2);

  // Convert milliseconds to minutes
  const diffInMinutes = diffInMilliseconds / 60000;

  return diffInMinutes;
}

function positionSoldOut(buyVolume: number, sellVolume: number) {
  return buyVolume - sellVolume === 0;
}
// function nextOrderCouldBePartOfPosition(buyVolume: number, sellVolume: number) {
//   if (currentIndex < ordersArray.length - 1) {
//     const nextOrder = ordersArray[currentIndex + 1];
//     console.log("Next Order:", nextOrder);
//     if (Math.abs(buyVolume - sellVolume) >= nextOrder.amount) return true;
//   }
//   return false;
// }
function isVolumeDifferenceWithinThreshold(
  buyVolume: number,
  sellVolume: number
) {
  const volumePercent =
    (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) * 100;
  console.log("  >>> volumePercent", volumePercent);
  return volumePercent <= VOLUME_THRESHOLD_PERCENT;
}

export function createPositionsFromOrders(
  orders: AggregatedOrder[],
  exchangeName: string
): Position[] {
  console.log("createPositionsFromOrders");
  console.log("args.orders", orders);
  let positions: Position[] = [];
  let openPosition = 0;
  let positionCost = 0;
  let positionBuyCost = 0;
  let positionSellCost = 0;
  let tempOrders: AggregatedOrder[] = [];

  orders.forEach((order: AggregatedOrder) => {
    tempOrders.push(order);
    if (positionCost === 0) {
      console.log("____________________________________________________ ");
      console.log("Position: long " + order.amount + order.time);
      console.log(" > start: openPosition    " + openPosition);
      console.log(" > start: positionCost    " + positionCost);
      console.log(" > start: positionBuyCost " + positionBuyCost);
    }
    console.log("order.type is ", order.type);
    if (order.type === "buy") {
      openPosition += order.amount;
      const buyCost = order.amount * order.averagePrice;
      positionBuyCost = positionBuyCost + buyCost;
      positionCost = positionCost + buyCost;
      console.log(" ");

      console.log(" >> positionBuyCost: " + positionBuyCost);
      console.log(" >> positionCost:    " + positionCost);
      console.log(" >>>> buyCost:         " + buyCost);
    } else {
      let amountSold = order.amount;
      const sellCost = order.amount * order.averagePrice;
      positionSellCost += sellCost;
      console.log(" > start: openPosition " + openPosition);
      console.log(" > start: amountSold " + amountSold);
      const dustAmount =
        amountSold > openPosition ? amountSold - openPosition : 0;
      console.log("Dust used: ", dustAmount);

      const relativePositionCost = (positionCost / openPosition) * amountSold;
      const profitLoss = sellCost - relativePositionCost;
      const relativePositionBuyCost =
        (positionBuyCost / openPosition) * amountSold;
      console.log(" ");
      console.log(" >> positionBuyCost: " + positionBuyCost);
      console.log(" >> openPosition before:    " + openPosition);
      console.log(" >>>> relativePositionBuyCost: " + relativePositionBuyCost);
      // Partial or full sell
      openPosition -= amountSold;
      positionCost -= relativePositionCost; // Adjust cost based on the proportion sold
      console.log(" >> openPosition after:    " + openPosition);
      console.log(" >> positionCost after:    " + positionCost);
      console.log(" >>>> amountSold:      " + amountSold);
      //process.exit();
      // Create a position if the open position is fully closed
      //if (openPosition === 0) {const duration =
      tempOrders[0].time - tempOrders[tempOrders.length - 1].time;
      const duration = minutesBetweenTimestamps(order.time, tempOrders[0].time);
      // if (order.time >= 1705310656789 && order.time <= 1705312257044) {
      //   const arbOrders = orders.filter(
      //     (order) =>
      //       order.time >= 1705310656789 && order.time <= 1705312257044
      //   );
      //   console.log(arbOrders);
      //   console.log("arbOrders above");
      //   console.log("positionCost: ", positionCost);
      //   console.log("sellCost: ", sellCost);
      //   console.log("ProfitLoss: ", profitLoss);
      //   //  process.exit();
      // }

      // console.log(arbOrders);
      // console.log("arbOrders above");
      console.log("positionCost: ", positionCost);
      console.log("sellCost:     ", sellCost);
      console.log("ProfitLoss:   ", profitLoss);
      const positionObject: Position = {
        time: tempOrders[0].time,
        date: new Date(order.time),
        price: Number(order.averagePrice),
        type: "long",
        buyCost: relativePositionBuyCost,
        sellCost: positionSellCost,
        profitLoss,
        exchange: exchangeName,
        orders: tempOrders.slice(),
        pair: order.pair,
        quantity: order.amount,
        duration,
        lastTime: order.time,
      };
      console.log(positionObject);

      positions.push(positionObject);
      console.log("Pushing to array ", positions.length);

      // Reset for the next set of matching orders
      tempOrders = [];
      console.log("Check nill setting:");
      console.log(positionBuyCost, positionSellCost);
      console.log(positionSoldOut(positionBuyCost, positionSellCost));
      console.log(
        isVolumeDifferenceWithinThreshold(positionBuyCost, positionSellCost)
      );
      if (
        positionSoldOut(positionBuyCost, positionSellCost) ||
        isVolumeDifferenceWithinThreshold(positionBuyCost, positionSellCost)
      ) {
        positionCost = 0;
        positionBuyCost = 0;
        positionSellCost = 0;
      } else {
        positionBuyCost = positionBuyCost - sellCost;
      }
      console.log(" > end: openPosition " + openPosition);
      console.log(" > end: positionCost" + positionCost);
      console.log(" > end: positionBuyCost" + positionBuyCost);
      console.log(" > end: positionSellCost" + positionSellCost);
    }
  });

  return positions;
}

/**
 * New version using orders from the exchange, not the orders I created
 */
// function createPositionsFromOrdersOld(
//   orders: AggregatedOrder[],
//   exchangeName: string
// ) {
//   let positions: Position[] = [];
//   let openPosition = 0;
//   let positionCost = 0;
//   let buyVolume = 0,
//     sellVolume = 0;
//   let buyCost = 0,
//     sellCost = 0;
//   let tempOrders: AggregatedOrder[] = [];

//   orders.forEach(
//     (order: AggregatedOrder, currentIndex: number, ordersArray: any) => {
//       // Accumulate volumes and costs
//       if (order.type === "buy") {
//         buyVolume += order.amount;
//         buyCost += order.amount * order.averagePrice;
//       } else {
//         sellVolume += order.amount;
//         sellCost += order.amount * order.averagePrice;
//       }

//       console.log("buyVolume", buyVolume);
//       tempOrders.push(order);
//       //console.log("tempOrders.length", tempOrders.length);
//       console.log("tempOrders", tempOrders);
//       const VOLUME_THRESHOLD_PERCENT = 2;
//       function isVolumeDifferenceWithinThreshold(
//         buyVolume: number,
//         sellVolume: number
//       ) {
//         return (
//           (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) *
//             100 <=
//           VOLUME_THRESHOLD_PERCENT
//         );
//       }

//       function positionSoldOut(buyVolume: number, sellVolume: number) {
//         return buyVolume - sellVolume === 0;
//       }
//       function nextOrderCouldBePartOfPosition(
//         buyVolume: number,
//         sellVolume: number
//       ) {
//         if (currentIndex < ordersArray.length - 1) {
//           const nextOrder = ordersArray[currentIndex + 1];
//           console.log("Next Order:", nextOrder);
//           if (Math.abs(buyVolume - sellVolume) >= nextOrder.amount) return true;
//         }
//         return false;
//       }
//       function minutesBetweenTimestamps(
//         timestamp1: number,
//         timestamp2: number
//       ): number {
//         const ts1 = timestamp1;
//         const ts2 = timestamp2;

//         // Calculate the difference in milliseconds
//         const diffInMilliseconds = Math.abs(ts1 - ts2);

//         // Convert milliseconds to minutes
//         const diffInMinutes = diffInMilliseconds / 60000;

//         return diffInMinutes;
//       }

//       // Check if buy and sell volumes match
//       if (sellVolume <= buyVolume) {
//         if (
//           positionSoldOut(buyVolume, sellVolume) ||
//           (isVolumeDifferenceWithinThreshold(buyVolume, sellVolume) &&
//             !nextOrderCouldBePartOfPosition(buyVolume, sellVolume))
//         ) {
//           // Create a position when buy and sell volumes are equal
//           const positionType: "long" | "short" =
//             buyVolume > sellVolume ? "long" : "short";
//           const quantity = buyVolume > sellVolume ? buyVolume : sellVolume;
//           const duration = minutesBetweenTimestamps(
//             tempOrders[0].time,
//             tempOrders[tempOrders.length - 1].time
//           );
//           const profitLoss =
//             positionType === "long" ? sellCost - buyCost : buyCost - sellCost;
//           positions.push({
//             time: tempOrders[0].time,
//             date: new Date(tempOrders[0].time),
//             price: Number(tempOrders[0].averagePrice),
//             type: positionType,
//             buyCost,
//             sellCost,
//             profitLoss,
//             exchange: exchangeName,
//             orders: tempOrders.slice(),
//             pair: tempOrders[0].pair,
//             quantity,
//             duration,
//             lastTime: tempOrders[tempOrders.length - 1].time,
//           });

//           // Reset for the next set of matching orders
//           buyVolume = 0;
//           sellVolume = 0;
//           buyCost = 0;
//           sellCost = 0;
//           tempOrders = [];
//         }
//       }
//     }
//   );

//   return positions;
// }
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

  async fetchPositions(
    market: string,
    exchangeName: string,
    since: number | undefined = undefined,
    limit: number = 1000
  ): Promise<any> {
    try {
      const orders = await this.fetchOrders(
        market,
        since ? since : undefined,
        limit
      );
      const positions = createPositionsFromOrders(orders, exchangeName);

      return positions;
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return {} as FetchTradesReturnType; // Return an empty Record<string, NormalizedTrade>
    }
  }

  async fetchOrders(
    market: string,
    since: number | undefined = undefined,
    limit: number = 1000
  ): Promise<AggregatedOrder[]> {
    try {
      if (since) console.log("Call fetchTrades since ", new Date(since));
      const rawOrders = await this.client.fetchOrders(
        market,
        since ? since : undefined,
        limit
      );

      /**
       * value Statuses = {
            'NEW': 'open',
            'PARTIALLY_FILLED': 'open',
            'ACCEPTED': 'open',
            'FILLED': 'closed',
            'CANCELED': 'canceled',
            'CANCELLED': 'canceled',
            'PENDING_CANCEL': 'canceling',
            'REJECTED': 'rejected',
            'EXPIRED': 'expired',
            'EXPIRED_IN_MATCH': 'expired',
        };
       */
      //console.log("rawTrades", rawOrders);
      //Only allow closed orders for now
      const orders = mapToAggregatedOrders(rawOrders).filter(
        (order) => order.status === "closed"
      );
      return orders;
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      const orders: AggregatedOrder[] = [];
      return orders;
    }
  }
  async fetchTrades(
    market: string,
    since: number | undefined = undefined,
    limit: number = 1000
  ): Promise<FetchTradesReturnType> {
    try {
      if (since) console.log("Call fetchTrades since ", new Date(since));
      console.log(market);
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

// const ethOrders: AggregatedOrder[] = [
//   {
//     orderId: "23126688",
//     time: 1517560885727,
//     date: new Date(1517560885727),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 861.6,
//     lowestPrice: 861.6,
//     averagePrice: 861.6,
//     exchange: "USDT",
//     amount: 0.55752,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "27595351",
//     time: 1518005531694,
//     date: new Date(1518005531694),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 776,
//     lowestPrice: 776,
//     averagePrice: 782.7727103981372,
//     exchange: "USDT",
//     amount: 1.35707,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "35487705",
//     time: 1519203434563,
//     date: new Date(1519203434563),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 880.65,
//     lowestPrice: 880.65,
//     averagePrice: 881.331151380368,
//     exchange: "USDT",
//     amount: 0.652,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "40752935",
//     time: 1520375106431,
//     date: new Date(1520375106431),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 816.45,
//     lowestPrice: 816.45,
//     averagePrice: 816.45,
//     exchange: "USDT",
//     amount: 1.285,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "66709964",
//     time: 1525912223756,
//     date: new Date(1525912223756),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 755,
//     lowestPrice: 755,
//     averagePrice: 754.98,
//     exchange: "USDT",
//     amount: 2.91034,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "66710616",
//     time: 1525912331929,
//     date: new Date(1525912331929),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 715.5,
//     lowestPrice: 715.5,
//     averagePrice: 716,
//     exchange: "USDT",
//     amount: 2.90743,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "75472284",
//     time: 1527764826319,
//     date: new Date(1527764826319),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 574.4,
//     lowestPrice: 574.4,
//     averagePrice: 574.4,
//     exchange: "USDT",
//     amount: 1.21866,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "75754118",
//     time: 1527838328315,
//     date: new Date(1527838328315),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 586.45,
//     lowestPrice: 586.45,
//     averagePrice: 586.45,
//     exchange: "USDT",
//     amount: 1.27877,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "75755702",
//     time: 1527838593628,
//     date: new Date(1527838593628),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 585.15,
//     lowestPrice: 585.15,
//     averagePrice: 585.15,
//     exchange: "USDT",
//     amount: 1.5,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "77281845",
//     time: 1528239777694,
//     date: new Date(1528239777694),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 610.7,
//     lowestPrice: 610.7,
//     averagePrice: 610.7,
//     exchange: "USDT",
//     amount: 4.28093,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "77694120",
//     time: 1528363166294,
//     date: new Date(1528363166294),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 607.94,
//     lowestPrice: 607.94,
//     averagePrice: 607.94,
//     exchange: "USDT",
//     amount: 4.61593,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "77695306",
//     time: 1528363445893,
//     date: new Date(1528363445893),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 608.51,
//     lowestPrice: 608.51,
//     averagePrice: 608.51,
//     exchange: "USDT",
//     amount: 4.61593,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "87576103",
//     time: 1530715985867,
//     date: new Date(1530715985867),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 476.04,
//     lowestPrice: 476.04,
//     averagePrice: 476.04,
//     exchange: "USDT",
//     amount: 19.67651,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "87887680",
//     time: 1530792180477,
//     date: new Date(1530792180477),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 471.28,
//     lowestPrice: 471.28,
//     averagePrice: 471.28,
//     exchange: "USDT",
//     amount: 7.36918,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "87934186",
//     time: 1530801697111,
//     date: new Date(1530801697111),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 469.61,
//     lowestPrice: 469.61,
//     averagePrice: 469.61,
//     exchange: "USDT",
//     amount: 12.3564,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "122232702",
//     time: 1537907911952,
//     date: new Date(1537907911952),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 214.75,
//     lowestPrice: 214.75,
//     averagePrice: 214.75,
//     exchange: "USDT",
//     amount: 2.79394,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "122234557",
//     time: 1537908105121,
//     date: new Date(1537908105121),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 213.62,
//     lowestPrice: 213.62,
//     averagePrice: 213.62,
//     exchange: "USDT",
//     amount: 2.80872,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "122309770",
//     time: 1537919131874,
//     date: new Date(1537919131874),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 217.85,
//     lowestPrice: 217.85,
//     averagePrice: 217.67,
//     exchange: "USDT",
//     amount: 2.75431,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "122321152",
//     time: 1537920716335,
//     date: new Date(1537920716335),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 211.6,
//     lowestPrice: 211.6,
//     averagePrice: 211.64,
//     exchange: "USDT",
//     amount: 4.17848,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "122323079",
//     time: 1537921001464,
//     date: new Date(15379210014640),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 222.3,
//     lowestPrice: 222.3,
//     averagePrice: 222.3,
//     exchange: "USDT",
//     amount: 4.17849,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "124188276",
//     time: 1538214897373,
//     date: new Date(1538214897373),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 228.2,
//     lowestPrice: 228.2,
//     averagePrice: 228.2,
//     exchange: "USDT",
//     amount: 0.2,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "124325823",
//     time: 1538235243960,
//     date: new Date(1538235243960),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 227.61,
//     lowestPrice: 227.61,
//     averagePrice: 227.8,
//     exchange: "USDT",
//     amount: 0.1,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "124326190",
//     time: 1538235278548,
//     date: new Date(1538235278548),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 223.2,
//     lowestPrice: 223.2,
//     averagePrice: 223.37,
//     exchange: "USDT",
//     amount: 0.1,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2387610778",
//     time: 1609239769077,
//     date: new Date(1609239769077),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 732.16,
//     lowestPrice: 732.16,
//     averagePrice: 732.16,
//     exchange: "USDT",
//     amount: 0.51081,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2388424159",
//     time: 1609245916817,
//     date: new Date(1609245916817),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 718.4,
//     lowestPrice: 718.4,
//     averagePrice: 718.4,
//     exchange: "USDT",
//     amount: 0.51081,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2423925459",
//     time: 1609603833159,
//     date: new Date(1609603833159),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 772,
//     lowestPrice: 772,
//     averagePrice: 772,
//     exchange: "USDT",
//     amount: 0.39656,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2439905885",
//     time: 1609713067163,
//     date: new Date(1609713067163),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 1139,
//     lowestPrice: 1139,
//     averagePrice: 1139,
//     exchange: "USDT",
//     amount: 0.39656,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2522820285",
//     time: 1610227939166,
//     date: new Date(1610227939166),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 1270.18,
//     lowestPrice: 1270.18,
//     averagePrice: 1270.18,
//     exchange: "USDT",
//     amount: 0.3924,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2522866160",
//     time: 1610228189026,
//     date: new Date(1610228189026),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 1263,
//     lowestPrice: 1263,
//     averagePrice: 1265,
//     exchange: "USDT",
//     amount: 0.3924,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2523146875",
//     time: 1610230395563,
//     date: new Date(1610230395563),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 1269,
//     lowestPrice: 1269,
//     averagePrice: 1269,
//     exchange: "USDT",
//     amount: 0.58916,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2549826647",
//     time: 1610381943134,
//     date: new Date(1610381943134),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 922.74,
//     lowestPrice: 922.74,
//     averagePrice: 922.74,
//     exchange: "USDT",
//     amount: 0.58916,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "2562156074",
//     time: 1610447444465,
//     date: new Date(1610447444465),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 1074.82,
//     lowestPrice: 1074.82,
//     averagePrice: 1074.82,
//     exchange: "USDT",
//     amount: 0.89658,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "15487634545",
//     time: 1704908191971,
//     date: new Date(1704908191971),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 2425.336876214173,
//     lowestPrice: 2425.336876214173,
//     averagePrice: 2425.336876214173,
//     exchange: "USDT",
//     amount: 25.4803,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "15488524206",
//     time: 1704910581082,
//     date: new Date(1704910581082),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 2427.6037257813605,
//     lowestPrice: 2427.6037257813605,
//     averagePrice: 2427.6037257813605,
//     exchange: "USDT",
//     amount: 25.4556,
//     trades: [],
//     status: "closed",
//   },
// ];

// const arbOrders: AggregatedOrder[] = [
//   {
//     orderId: "930500823",
//     time: 1705310656789,
//     date: new Date(1705310656789),
//     type: "buy",
//     pair: "ARB/USDT",
//     highestPrice: 2.103468574163082,
//     lowestPrice: 2.103468574163082,
//     averagePrice: 2.103468574163082,
//     exchange: "USDT",
//     amount: 19016.2,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "930629572",
//     time: 1705312257044,
//     date: new Date(1705312257044),
//     type: "sell",
//     pair: "ARB/USDT",
//     highestPrice: 2.14,
//     lowestPrice: 2.14,
//     averagePrice: 2.14,
//     exchange: "USDT",
//     amount: 4833.1,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "931930815",
//     time: 1705328148003,
//     date: new Date(1705328148003),
//     type: "sell",
//     pair: "ARB/USDT",
//     highestPrice: 2.129223028697937,
//     lowestPrice: 2.129223028697937,
//     averagePrice: 2.129223028697937,
//     exchange: "USDT",
//     amount: 14499.3,
//     trades: [],
//     status: "closed",
//   },
// ];
// const arbOrders: AggregatedOrder[] = [
//   {
//     orderId: "930500823",
//     time: 1705310656789,
//     date: new Date(1705310656789),
//     type: "buy",
//     pair: "ARB/USDT",
//     highestPrice: 2.103468574163082,
//     lowestPrice: 2.103468574163082,
//     averagePrice: 2.103468574163082,
//     exchange: "USDT",
//     amount: 19016.2,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "930629572",
//     time: 1705312257044,
//     date: new Date(1705312257044),
//     type: "sell",
//     pair: "ARB/USDT",
//     highestPrice: 2.14,
//     lowestPrice: 2.14,
//     averagePrice: 2.14,
//     exchange: "USDT",
//     amount: 4833.1,
//     trades: [],
//     status: "closed",
//   },
// ];

// const ethPositions = createPositionsFromOrders(ethOrders, "binance");

// logArrayAndNestedOrders("> arbPositions", ethPositions);
// const ethOrdersThisYear: AggregatedOrder[] = [
//   {
//     orderId: "15487634545",
//     time: 1704908191971,
//     date: new Date(1704908191971),
//     type: "buy",
//     pair: "ETH/USDT",
//     highestPrice: 2425.336876214173,
//     lowestPrice: 2425.336876214173,
//     averagePrice: 2425.336876214173,
//     exchange: "USDT",
//     amount: 25.4803,
//     trades: [],
//     status: "closed",
//   },
//   {
//     orderId: "15488524206",
//     time: 1704910581082,
//     date: new Date(1704910581082),
//     type: "sell",
//     pair: "ETH/USDT",
//     highestPrice: 2427.6037257813605,
//     lowestPrice: 2427.6037257813605,
//     averagePrice: 2427.6037257813605,
//     exchange: "USDT",
//     amount: 25.4556,
//     trades: [],
//     status: "closed",
//   },
// ];
// const ethPositions = createPositionsFromOrders(ethOrdersThisYear, "binance");
// console.log("arbPositions", ethPositions);
