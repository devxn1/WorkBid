import { defineAuth } from "@aws-amplify/backend"
import { preSignUp } from "./pre-sign-up/resource"

/**
 * Login with email + password (Amazon Cognito).
 * Email verification is off: the preSignUp trigger confirms new accounts right away.
 * The role picked at sign-up is saved in "custom:userType"; after their first sign-in
 * it's copied into their UserProfile (see data/resource.ts and lib/auth.ts).
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    givenName: { required: true, mutable: true },
    familyName: { required: true, mutable: true },
    "custom:userType": { dataType: "String", mutable: true },
  },
  triggers: {
    preSignUp,
  },
})
