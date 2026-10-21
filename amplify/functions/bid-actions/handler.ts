import { Amplify } from "aws-amplify"
import { generateClient } from "aws-amplify/data"
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime"
import { env } from "$amplify/env/bid-actions"
import type { Schema } from "../../data/resource"

// Connect to the database with this function's own (IAM) permissions.
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
// Workaround: aws-amplify 6.22 ignores libraryOptions.Auth (the Lambda's IAM credentials)
// unless the config also has an Auth section, which made every call fail with
// "No credentials". This placeholder is never used for sign-in; it only lets
// Amplify pick up the credentials provider above.
Amplify.configure(
  {
    ...resourceConfig,
    Auth: {
      Cognito: { identityPoolId: `${env.AWS_REGION}:00000000-0000-0000-0000-000000000000`, allowGuestAccess: true },
    },
  },
  libraryOptions,
)
const client = generateClient<Schema>()

type PlaceBidEvent = Parameters<Schema["placeBid"]["functionHandler"]>[0]
type RespondToBidEvent = Parameters<Schema["respondToBid"]["functionHandler"]>[0]
type ReviseBidEvent = Parameters<Schema["reviseBid"]["functionHandler"]>[0]
type StartConversationEvent = Parameters<Schema["startConversation"]["functionHandler"]>[0]
type Bid = Schema["Bid"]["type"]
type Conversation = Schema["Conversation"]["type"]

/** The signed-in caller's Cognito user id ("sub"). */
function callerId(event: { identity?: unknown }): string {
  const sub = (event.identity as { sub?: string } | null | undefined)?.sub
  if (!sub) throw new Error("You must be signed in.")
  return sub
}

/** Unwraps a data call: throws the first error, or returns the data. */
function unwrap<T>(result: { data: T; errors?: { message: string }[] }, what: string): NonNullable<T> {
  if (result.errors?.length) throw new Error(`${what}: ${result.errors[0].message}`)
  if (result.data == null) throw new Error(`${what}: not found.`)
  return result.data as NonNullable<T>
}

/** Throws if a bid's amount or timeline is out of range. */
function checkAmountAndDays(amount: number, estimatedDays: number) {
  if (!(amount > 0)) throw new Error("Bid amount must be greater than 0.")
  if (!Number.isInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 3650) {
    throw new Error("Estimated days must be a whole number between 1 and 3650.")
  }
}

async function placeBid(event: PlaceBidEvent): Promise<Bid> {
  const contractorId = callerId(event)
  const { projectId, amount, estimatedDays, proposalMessage } = event.arguments

  const profile = unwrap(await client.models.UserProfile.get({ userId: contractorId }), "Profile")
  if (profile.userType !== "contractor") throw new Error("Only contractor accounts can place bids.")

  const project = unwrap(await client.models.Project.get({ id: projectId }), "Project")
  if (project.status !== "open") throw new Error("This project is no longer accepting bids.")
  if (project.clientId === contractorId) throw new Error("You can't bid on your own project.")

  checkAmountAndDays(amount, estimatedDays)
  const message = proposalMessage.trim()
  if (message.length < 10) throw new Error("Proposal message must be at least 10 characters.")

  const { data: myBids } = await client.models.Bid.listBidByContractorId({ contractorId }, { limit: 1000 })
  if (myBids.some((b) => b.projectId === projectId)) throw new Error("You already placed a bid on this project.")

  return unwrap(
    await client.models.Bid.create({
      projectId,
      contractorId,
      clientId: project.clientId, // taken from the project, not trusted from the browser
      amount,
      estimatedDays,
      proposalMessage: message,
      status: "pending",
    }),
    "Create bid",
  )
}

async function reviseBid(event: ReviseBidEvent): Promise<Bid> {
  const callerIdValue = callerId(event)
  const { bidId, amount, estimatedDays } = event.arguments

  const bid = unwrap(await client.models.Bid.get({ id: bidId }), "Bid")
  if (bid.contractorId !== callerIdValue) throw new Error("You can only update your own bid.")
  if (bid.status !== "pending") throw new Error(`This bid was already ${bid.status}, so it can't be changed.`)
  const project = unwrap(await client.models.Project.get({ id: bid.projectId }), "Project")
  if (project.status !== "open") throw new Error("This project has already been awarded.")

  checkAmountAndDays(amount, estimatedDays)
  if (amount === bid.amount && estimatedDays === bid.estimatedDays) throw new Error("Nothing changed.")

  return unwrap(
    await client.models.Bid.update({ id: bidId, amount, estimatedDays, amountUpdatedAt: new Date().toISOString() }),
    "Update bid",
  )
}

async function respondToBid(event: RespondToBidEvent): Promise<Bid> {
  const callerIdValue = callerId(event)
  const { bidId, accept, expectedAmount } = event.arguments

  const bid = unwrap(await client.models.Bid.get({ id: bidId }), "Bid")
  const project = unwrap(await client.models.Project.get({ id: bid.projectId }), "Project")
  if (project.clientId !== callerIdValue) throw new Error("Only the client who posted this project can respond to bids.")
  if (project.status !== "open") throw new Error("This project has already been awarded.")
  if (bid.status !== "pending") throw new Error(`This bid was already ${bid.status}.`)

  if (!accept) {
    return unwrap(await client.models.Bid.update({ id: bidId, status: "rejected" }), "Decline bid")
  }

  // Don't let the client accept a price they haven't seen (the contractor may have just changed it).
  if (expectedAmount != null && expectedAmount !== bid.amount) {
    throw new Error(`The contractor just changed this bid to $${bid.amount.toLocaleString("en-US")}. Review it before accepting.`)
  }

  // Accept: award the project, then reject every other pending bid on it.
  unwrap(
    await client.models.Project.update({
      id: project.id,
      status: "in_progress",
      awardedContractorId: bid.contractorId,
      startDate: new Date().toISOString(),
    }),
    "Award project",
  )
  const accepted = unwrap(await client.models.Bid.update({ id: bidId, status: "accepted" }), "Accept bid")

  const { data: projectBids } = await client.models.Bid.listBidByProjectId({ projectId: project.id }, { limit: 1000 })
  await Promise.all(
    projectBids
      .filter((b) => b.id !== bidId && b.status === "pending")
      .map((b) => client.models.Bid.update({ id: b.id, status: "rejected" })),
  )

  return accepted
}

async function startConversation(event: StartConversationEvent): Promise<Conversation> {
  const callerIdValue = callerId(event)
  const { projectId, contractorId } = event.arguments

  const project = unwrap(await client.models.Project.get({ id: projectId }), "Project")
  if (callerIdValue !== project.clientId && callerIdValue !== contractorId) {
    throw new Error("Only the project's client or the contractor can start this conversation.")
  }

  // The two are only connected if the contractor bid on this project.
  const { data: projectBids } = await client.models.Bid.listBidByProjectId({ projectId }, { limit: 1000 })
  if (!projectBids.some((b) => b.contractorId === contractorId)) {
    throw new Error("You can only message about a project the contractor has bid on.")
  }

  const { data: theirConversations } = await client.models.Conversation.listConversationByContractorId(
    { contractorId },
    { limit: 1000 },
  )
  const existing = theirConversations.find((c) => c.projectId === projectId)
  if (existing) return existing

  // Names come from the database, not the browser, so nobody can pose as someone else.
  const [{ data: contractorProfile }, { data: contractorUser }] = await Promise.all([
    client.models.ContractorProfile.get({ contractorId }),
    client.models.UserProfile.get({ userId: contractorId }),
  ])
  const contractorName =
    contractorProfile?.contractorName ||
    `${contractorUser?.firstName ?? ""} ${contractorUser?.lastName ?? ""}`.trim() ||
    "Contractor"

  return unwrap(
    await client.models.Conversation.create({
      projectId,
      projectTitle: project.title,
      clientId: project.clientId,
      clientName: project.clientName,
      contractorId,
      contractorName,
      contractorAvatar: contractorProfile?.avatar ?? contractorUser?.avatar ?? null,
    }),
    "Start conversation",
  )
}

export const handler = async (
  event: PlaceBidEvent | ReviseBidEvent | RespondToBidEvent | StartConversationEvent,
) => {
  // Amplify puts the mutation name at the top level of the event ("fieldName"),
  // not under event.info like a plain AppSync Lambda resolver.
  const fieldName = (event as { fieldName?: string }).fieldName ?? event.info?.fieldName
  switch (fieldName) {
    case "placeBid":
      return placeBid(event as PlaceBidEvent)
    case "reviseBid":
      return reviseBid(event as ReviseBidEvent)
    case "respondToBid":
      return respondToBid(event as RespondToBidEvent)
    case "startConversation":
      return startConversation(event as StartConversationEvent)
    default:
      throw new Error(`Unknown operation: ${fieldName}`)
  }
}
