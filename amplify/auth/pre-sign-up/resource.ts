import { defineFunction } from "@aws-amplify/backend"

/** Runs before Cognito creates a user. Confirms the account right away so there's no email code step. */
export const preSignUp = defineFunction({
  name: "pre-sign-up",
  entry: "./handler.ts",
  resourceGroupName: "auth",
})
