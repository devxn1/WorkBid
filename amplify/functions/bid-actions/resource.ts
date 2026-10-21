import { defineFunction } from "@aws-amplify/backend"

/**
 * Backend function (AWS Lambda) behind every bidding, hiring, change-order and
 * startConversation mutation. These go through here instead of being written by the
 * browser, so the rules (who may bid, revise, accept, approve, message whom, and which
 * status changes are allowed) are enforced on the server.
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
