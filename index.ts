import axios from 'axios';
import { Client } from '@notionhq/client';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Kraken API details
const krakenApiKey = process.env.KRAKEN_API_KEY as string;
const krakenApiSecret = process.env.KRAKEN_API_SECRET as string;

// Notion API details
const notionToken = process.env.NOTION_TOKEN as string;
const databaseId = process.env.DATABASE_ID as string;

// Initialize Notion client
const notion = new Client({ auth: notionToken });

// Function to get Kraken signature
function getKrakenSignature(path: string, request: any, secret: string): string {
  const message = JSON.stringify(request);
  const secret_buffer = Buffer.from(secret, 'base64');
  const hash = crypto.createHash('sha256');
  const hmac = crypto.createHmac('sha512', secret_buffer);
  const hash_digest = hash.update(request.nonce + message).digest('binary');
  const hmac_digest = hmac.update(path + hash_digest, 'binary').digest('base64');

  return hmac_digest;
}

// Function to fetch trades from Kraken
async function fetchKrakenTrades() {
  const path = '/0/private/TradesHistory';
  const nonce = new Date().getTime() * 1000; // nonce as milliseconds
  const headers = {
    'API-Key': krakenApiKey,
    'API-Sign': getKrakenSignature(path, { nonce }, krakenApiSecret),
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post(`https://api.kraken.com${path}`, { nonce }, { headers });
    //console.log('Kraken response:', response.data);
    return response.data.result.trades;
  } catch (error) {
    console.error('Error fetching trades from Kraken:', error);
    return {};
  }
}

interface TradeOld {
    txid: string;
    pair: string;
    vol: number;
    // Add other fields as necessary
  }
  interface Trade {
    ordertxid: string;
    postxid: string;
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
    trade_id: number;
  }
  // Function to insert trades into Notion
  async function insertTradesToNotion(trades: Record<string, Trade>) {
    for (const [tradeID, tradeDetail] of Object.entries(trades)) {
      // Ensure the trade details have the necessary properties
      console.log("tradeID is", tradeID);
      console.log("tradeDetail is ", tradeDetail);

      if (!tradeDetail || !tradeDetail.pair || !tradeDetail.vol) {
        console.error(`Trade details are missing for trade ID: ${tradeID}`);
        continue;
      }
  
      const page = {
        parent: { database_id: databaseId },
        properties: {
          'Trade ID': { title: [{ text: { content: tradeID } }] },
          'Date': { 
            date: { 
              start: new Date(tradeDetail.time * 1000).toISOString(),
              // If you have an end date, include it as well
              // end: new Date(endTime).toISOString() 
            } 
          },
          'Asset': { rich_text: [{ text: { content: tradeDetail.pair } }] },
          'Amount': { 
            rich_text: [{ text: { content: tradeDetail.vol.toString() } }]
          }
          // Map other properties as needed
        },
      };
  
      try {
        await notion.pages.create(page);
        
      } catch (error) {
        console.error(`Error inserting trade ${tradeID} into Notion:`, error);
      }process.exit()
    }
  }

// Main function to execute the process
async function main() {
    const trades = await fetchKrakenTrades();
    await insertTradesToNotion(trades);
  }
  main()