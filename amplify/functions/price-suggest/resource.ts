import { defineFunction, secret } from "@aws-amplify/backend"

/**
 * Suggests a budget range while a client posts a project. Asks Claude, giving it the
 * job details plus what similar WorkBid jobs actually went for.
 *
 * Needs the Anthropic API key saved as an Amplify secret:
 *   npx ampx sandbox secret set ANTHROPIC_API_KEY
 */
export const priceSuggest = defineFunction({
  name: "price-suggest",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  resourceGroupName: "data",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
})
