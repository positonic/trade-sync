# Portfolio Balance Tracker

Portfolio Balance Tracker is a Node.js application designed to fetch and calculate the USD value of cryptocurrency balances from various exchanges every hour using GitHub Actions for automation. It interfaces with exchanges via the ccxt library, processes balances, and optionally can insert them into a Notion database for record-keeping and tracking.

## Features

1. Fetches balances from multiple exchanges (Kraken, Bybit, Binance, etc.)
2. Calculates the USD value of each currency in the portfolio.
3. Aggregates total portfolio value.
4. Schedules tasks to run every hour using GitHub Actions.
5. Saves total USD balance information into a Notion database.

## Project Structure

- balances.ts:
  Fetches balances from requested exchanges e.g: "Binance ETH", "Kraken ETH", "Kraken BTC" balances, and saves each coins balance in the database table (specified by NOTION_BALANCES_DATABASE_ID in the .env). It also fetches the USD price and calculates the value in USD at the time it's saved, and saves each of these values for the Exhange-Coin. It also calculates a running total for the USD value and saves this in the Portfolio values table (specified by NOTION_PORTFOLIO_VALUE_DATABASE_ID in the .env)
- trades.ts:
  For each exchange specified it will call the exchange api, retrieve the trades and save these to the Notion database (specified by NOTION_TRADES_DATABASE_ID in the .env)

## Usage

### Installation:

1. Clone the repository.
2. Install dependencies using yarn install or npm install.

### Configuration:

Save .env.examples as .env, and add the configuartion variables:
NOTION_TOKEN=(Notion access Token)
NOTION_TRADES_DATABASE_ID=(Create the database in Notion)
NOTION_BALANCES_DATABASE_ID=(Create the database in Notion)
NOTION_PORTFOLIO_VALUE_DATABASE_ID=(Create the database in Notion)
KRAKEN_API_KEY=(Exchange view only api keys)
KRAKEN_API_SECRET=(Exchange view only api keys)
BINANCE_API_KEY=(Exchange view only api keys)
BINANCE_API_SECRET=(Exchange view only api keys)
BYBIT_API_KEY=(Exchange view only api keys)
BYBIT_API_SECRET=(Exchange view only api keys)

### Running Locally:

Run `balances.ts` or `trades.ts` locally using ts-node, or `tsc`, then `node dist/balance.ts` etc

Execute the script to see the balances and total portfolio value in the notion databases

## Automate saving balances by scheduling with GitHub Actions:

This repo includes a file to automatically run your balance updates every hour using Github actions.

Push this code to your GitHub repository, and ensure GitHub Actions is enabled for the repository.

The .github/workflows/schedule.yml file will trigger the script to run every hour on the hour.

### GitHub Actions Workflow

The script is scheduled to run every hour using GitHub Actions. The workflow (schedule.yml) is responsible for setting up the environment, installing dependencies, compiling the TypeScript code, and executing the script.

### Error Handling and Logging

The script includes error handling for each exchange operation. It logs a success message with the total USD value calculated for each exchange and an error message for any issues encountered during processing.

### Contribution

Contributions are welcome! Please feel free to submit a pull request or create an issue for bugs, questions, or new features.

### License

Specify your license or if the project is open source, you might include a common open-source license such as MIT.
