import { Horizon } from "stellar-sdk";

export const server = new Horizon.Server(
  "https://horizon-testnet.stellar.org"
);