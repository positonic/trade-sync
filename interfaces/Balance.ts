export interface Balance {
  free: { [currency: string]: number };
  used: { [currency: string]: number };
  total: { [currency: string]: number };
  usdValue?: { [currency: string]: number }; // Add this line
}
