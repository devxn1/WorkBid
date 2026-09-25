import { defineAuth } from "@aws-amplify/backend"

/**
 * Login with email + password (Amazon Cognito).
 * Whether someone is a client or a contractor is stored in their UserProfile (see data/resource.ts).
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    givenName: { required: true, mutable: true },
    familyName: { required: true, mutable: true },
  },
})
