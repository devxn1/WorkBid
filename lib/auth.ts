import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth"
import { generateClient } from "aws-amplify/data"
import type { Schema } from "@/amplify/data/resource"
import type { UserType } from "./types"

/**
 * Makes sure the signed-in user has a UserProfile row and returns their role.
 * The first time someone signs in, the profile is created from what they entered
 * at sign-up (name + the "custom:userType" role saved in Cognito).
 */
export async function ensureUserProfile(): Promise<UserType> {
  const client = generateClient<Schema>()
  const { userId } = await getCurrentUser()

  const { data: existing } = await client.models.UserProfile.get({ userId })
  if (existing) return existing.userType as UserType

  const attributes = await fetchUserAttributes()
  const userType: UserType = attributes["custom:userType"] === "contractor" ? "contractor" : "client"

  const { data, errors } = await client.models.UserProfile.create({
    userId,
    firstName: attributes.given_name ?? "",
    lastName: attributes.family_name ?? "",
    userType,
  })
  if (errors?.length) throw new Error(errors[0].message)
  return (data?.userType as UserType) ?? userType
}

/** Turns Cognito's error codes into messages a user can act on. */
export function authErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again."
  switch (err.name) {
    case "UsernameExistsException":
      return "An account with this email already exists. Try signing in instead."
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect email or password."
    case "CodeMismatchException":
      return "That code isn't right. Check your email and try again."
    case "ExpiredCodeException":
      return "That code has expired. Send a new one."
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a few minutes and try again."
    case "InvalidPasswordException":
      return err.message.replace("Password did not conform with policy: ", "")
    default:
      return err.message || "Something went wrong. Please try again."
  }
}
