import { defineFunction } from "@aws-amplify/backend"

/**
 * Backend function (AWS Lambda) behind the placeBid, reviseBid, respondToBid and
 * startConversation mutations. These go through here instead of being written by
 * the browser, so the rules (who may bid, who may accept, who may message whom)
 * are enforced on the server.
 *
 * resourceGroupName "data" keeps it in the data stack, since it both serves the
 * API and reads/writes the database (avoids a circular dependency between stacks).
 */
export const bidActions = defineFunction({
  name: "bid-actions",
  entry: "./handler.ts",
  timeoutSeconds: 20,
  resourceGroupName: "data",
})
