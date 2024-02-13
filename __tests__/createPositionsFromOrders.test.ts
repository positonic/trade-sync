import {
  AggregatedOrder,
  createPositionsFromOrders,
} from "../exchanges/Exchange";
function logArrayAndNestedOrders(objectName: string, array: any) {
  console.log("Positions:");
  for (let i = 0; i < array.length; i++) {
    const obj = array[i];
    console.log(objectName + i + 1 + ":", obj);

    if (obj.orders && Array.isArray(obj.orders)) {
      console.log("Nested Orders:");
      for (let j = 0; j < obj.orders.length; j++) {
        console.log(obj.orders[j]);
      }
    }
  }
}
describe("createPositionsFromOrders", () => {
  it("should create positions correctly", () => {
    const orders: AggregatedOrder[] = [
      {
        orderId: "930500823",
        time: 1705310656789,
        date: new Date(1705310656789),
        type: "buy",
        pair: "ARB/USDT",
        highestPrice: 2.103468574163082,
        lowestPrice: 2.103468574163082,
        averagePrice: 2.103468574163082,
        exchange: "USDT",
        amount: 19016.2,
        trades: [],
        status: "closed",
      },
      {
        orderId: "930629572",
        time: 1705312257044,
        date: new Date(1705312257044),
        type: "sell",
        pair: "ARB/USDT",
        highestPrice: 2.14,
        lowestPrice: 2.14,
        averagePrice: 2.14,
        exchange: "USDT",
        amount: 4833.1,
        trades: [],
        status: "closed",
      },
      {
        orderId: "931930815",
        time: 1705328148003,
        date: new Date(1705328148003),
        type: "sell",
        pair: "ARB/USDT",
        highestPrice: 2.129223028697937,
        lowestPrice: 2.129223028697937,
        averagePrice: 2.129223028697937,
        exchange: "USDT",
        amount: 14499.3,
        trades: [],
        status: "closed",
      },
    ];

    const positions = createPositionsFromOrders(orders, "binance");

    console.log(
      "Returned Positions are: ",
      logArrayAndNestedOrders("positions", positions)
    );
    // Add some assertions here based on what you expect the output to be
    // For example:
    // expect(positions).toHaveLength(1);
    // expect(positions[0]).toHaveProperty('id', '123');
  });
});
