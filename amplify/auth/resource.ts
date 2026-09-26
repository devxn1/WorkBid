import { defineAuth } from "@aws-amplify/backend"

/**
 * Login with email + password (Amazon Cognito).
 * The role picked at sign-up is saved in "custom:userType" so it survives until the
 * user confirms their email; after their first sign-in it's copied into their
 * UserProfile (see data/resource.ts and lib/auth.ts).
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
})
