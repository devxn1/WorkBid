import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth"
import { generateClient } from "aws-amplify/data"
import type { Schema } from "@/amplify/data/resource"
import type { UserType } from "./types"

/** The signed-in person, combined from Cognito (email) and their UserProfile row. */
export interface AuthUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  userType: UserType
  avatar: string | null
}

type UserProfileRow = Schema["UserProfile"]["type"]

/**
 * Returns the signed-in user's UserProfile row, creating it the first time they sign in
 * from what they entered at sign-up (name + the "custom:userType" role saved in Cognito).
 */
async function getOrCreateUserProfile(userId: string): Promise<UserProfileRow> {
  const client = generateClient<Schema>()

  const { data: existing } = await client.models.UserProfile.get({ userId })
  if (existing) return existing

  const attributes = await fetchUserAttributes()
  const { data, errors } = await client.models.UserProfile.create({
    userId,
    firstName: attributes.given_name ?? "",
    lastName: attributes.family_name ?? "",
    userType: attributes["custom:userType"] === "contractor" ? "contractor" : "client",
  })
  if (data) return data

  // Another tab (or request) may have created it at the same moment — read it back.
  const { data: retry } = await client.models.UserProfile.get({ userId })
  if (retry) return retry
  throw new Error(errors?.[0]?.message ?? "Couldn't create your profile.")
}

/** Loads the signed-in user, or returns null when nobody is signed in. */
export async function loadAuthUser(): Promise<AuthUser | null> {
  let userId: string
  try {
    ;({ userId } = await getCurrentUser())
  } catch {
    return null // not signed in
  }

  const [profile, attributes] = await Promise.all([getOrCreateUserProfile(userId), fetchUserAttributes()])
  return {
    userId,
    email: attributes.email ?? "",
    firstName: profile.firstName,
    lastName: profile.lastName,
    userType: profile.userType === "contractor" ? "contractor" : "client",
    avatar: profile.avatar ?? null,
  }
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
