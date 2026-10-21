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

type Operation =
  | "placeBid"
  | "reviseBid"
  | "requestRevision"
  | "declineBid"
  | "withdrawBid"
  | "confirmAgreement"
  | "completeProject"
  | "proposeChangeOrder"
  | "respondToChangeOrder"
  | "startConversation"
/** The event a mutation's handler receives (its arguments plus the caller's identity). */
type Args<K extends Operation> = Parameters<Schema[K]["functionHandler"]>[0]
type Bid = Schema["Bid"]["type"]
type BidStatus = NonNullable<Bid["status"]>
type BidVersion = Schema["BidVersion"]["type"]
type Project = Schema["Project"]["type"]
type Agreement = Schema["Agreement"]["type"]
type ChangeOrder = Schema["ChangeOrder"]["type"]
type Conversation = Schema["Conversation"]["type"]

/** Bids that are still in play: the client can accept, decline or ask for changes. */
const OPEN_BID_STATUSES: BidStatus[] = ["pending", "revision_requested"]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// Every Bid field, so a conditional bid update still sends the full bid to live
// subscribers (they receive exactly the fields the mutation selects).
const BID_FIELDS = `id projectId contractorId clientId amount estimatedDays proposalMessage status amountUpdatedAt
  currentVersionId currentVersion previousAmount revisionNote revisionRequestedAt createdAt updatedAt`

/**
 * Updates a row only if `condition` still holds (checked atomically by DynamoDB).
 * Returns false if it no longer holds, e.g. someone else changed the row first.
 * The generated model client can't pass a condition, so this calls the API directly.
 */
async function updateIf(
  model: "Project" | "Bid" | "ChangeOrder",
  input: Record<string, unknown> & { id: string },
  condition: Record<string, unknown>,
): Promise<boolean> {
  const fields = model === "Bid" ? BID_FIELDS : "id"
  try {
    await client.graphql({
      query: `mutation Update($input: Update${model}Input!, $condition: Model${model}ConditionInput) {
        update${model}(input: $input, condition: $condition) { ${fields} }
      }`,
      variables: { input, condition },
    })
    return true
  } catch (err) {
    const errors = (err as { errors?: { errorType?: string; message?: string }[] }).errors
    if (errors?.some((e) => e.errorType?.includes("ConditionalCheckFailed"))) return false
    throw new Error(errors?.[0]?.message ?? String(err))
  }
}

/** Condition: the bid's status is one of `statuses`. */
function statusIn(statuses: string[]) {
  return { or: statuses.map((status) => ({ status: { eq: status } })) }
}

/** A user's display name (and business name for contractors). */
async function displayName(userId: string) {
  const [{ data: user }, { data: contractor }] = await Promise.all([
    client.models.UserProfile.get({ userId }),
    client.models.ContractorProfile.get({ contractorId: userId }),
  ])
  const name =
    contractor?.contractorName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "A WorkBid user"
  return { name, businessName: contractor?.businessName ?? null, avatar: contractor?.avatar ?? user?.avatar ?? null }
}

/** Sends an in-app notification. Never throws: a failed notification mustn't undo the action. */
async function notify(userId: string, title: string, body: string, href: string) {
  try {
    unwrap(await client.models.Notification.create({ userId, title, body, href, read: false }), "Notification")
  } catch (err) {
    console.error("Couldn't send notification", { userId, title }, err)
  }
}

/** Finds the conversation between a project's client and a contractor, creating it if needed. */
async function findOrCreateConversation(project: Project, contractorId: string): Promise<Conversation> {
  const { data: theirConversations } = await client.models.Conversation.listConversationByContractorId(
    { contractorId },
    { limit: 1000 },
  )
  const existing = theirConversations.find((c) => c.projectId === project.id)
  if (existing) return existing

  // Names come from the database, not the browser, so nobody can pose as someone else.
  const contractor = await displayName(contractorId)
  return unwrap(
    await client.models.Conversation.create({
      projectId: project.id,
      projectTitle: project.title,
      clientId: project.clientId,
      clientName: project.clientName,
      contractorId,
      contractorName: contractor.name,
      contractorAvatar: contractor.avatar,
    }),
    "Start conversation",
  )
}

/**
 * Posts an automatic note into the client/contractor chat (e.g. "Revision requested"),
 * so the negotiation reads in one place. Informational only: messages never change a bid.
 * Never throws.
 */
async function postToConversation(project: Project, contractorId: string, senderId: string, body: string) {
  try {
    const conv = await findOrCreateConversation(project, contractorId)
    const sender = await displayName(senderId)
    unwrap(
      await client.models.Message.create({
        conversationId: conv.id,
        senderId,
        senderName: senderId === project.clientId ? project.clientName : sender.name,
        receiverId: senderId === project.clientId ? contractorId : project.clientId,
        messageBody: body,
        sentAt: new Date().toISOString(),
      }),
      "Message",
    )
  } catch (err) {
    console.error("Couldn't post to conversation", err)
  }
}

function money(amount: number) {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

/**
 * The earliest allowed start date, as YYYY-MM-DD: yesterday in UTC, so "today" is accepted
 * in every US time zone (UTC is already tomorrow there in the evening).
 */
function earliestStartDate() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

type ProposalInput = Pick<
  BidVersion,
  | "amount"
  | "scope"
  | "estimatedDays"
  | "startDate"
  | "paymentTerms"
  | "materialsCost"
  | "laborCost"
  | "materialsDetail"
  | "included"
  | "excluded"
  | "notes"
>

/** Validates and cleans up proposal terms from the browser. Throws a readable error. */
function cleanProposal(input: ProposalInput) {
  const { amount, estimatedDays } = input
  if (!(amount > 0) || amount > 100_000_000) throw new Error("Price must be greater than $0.")
  if (!Number.isInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 3650) {
    throw new Error("Estimated duration must be a whole number of days between 1 and 3650.")
  }
  const scope = input.scope.trim()
  if (scope.length < 10) throw new Error("Describe the scope of work (at least 10 characters).")
  if (scope.length > 5000) throw new Error("Scope of work is too long (5000 characters max).")
  const paymentTerms = input.paymentTerms?.trim() ?? ""
  if (paymentTerms.length < 3) throw new Error("Add payment terms, e.g. \"50% upfront, 50% on completion\".")
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Add a proposed start date.")
  if (input.startDate < earliestStartDate()) throw new Error("The proposed start date can't be in the past.")
  for (const [label, cost] of [
    ["Materials cost", input.materialsCost],
    ["Labor cost", input.laborCost],
  ] as const) {
    if (cost != null && !(cost >= 0)) throw new Error(`${label} can't be negative.`)
  }
  const list = (items: (string | null)[] | null | undefined, label: string) => {
    const cleaned = (items ?? []).map((i) => (i ?? "").trim()).filter(Boolean)
    if (cleaned.length > 25) throw new Error(`Too many ${label} items (25 max).`)
    return cleaned
  }
  const notes = input.notes?.trim() || null
  if (notes && notes.length > 3000) throw new Error("Notes are too long (3000 characters max).")
  return {
    amount,
    estimatedDays,
    scope,
    paymentTerms,
    startDate: input.startDate,
    materialsCost: input.materialsCost ?? null,
    laborCost: input.laborCost ?? null,
    materialsDetail: input.materialsDetail?.trim() || null,
    included: list(input.included, "included"),
    excluded: list(input.excluded, "excluded"),
    notes,
  }
}

/** The required agreement terms a version is missing (empty when it can be confirmed). */
function missingTerms(v: BidVersion) {
  const missing: string[] = []
  if (!(v.amount > 0)) missing.push("price")
  if (!v.scope?.trim()) missing.push("scope of work")
  if (!v.startDate) missing.push("start date")
  if (!(v.estimatedDays > 0)) missing.push("estimated duration")
  if (!v.paymentTerms?.trim()) missing.push("payment terms")
  return missing
}

/**
 * The bid's current version. Bids placed before versions existed get a version 1
 * built from their fields the first time it's needed.
 */
async function currentVersion(bid: Bid): Promise<BidVersion> {
  if (bid.currentVersionId) return unwrap(await client.models.BidVersion.get({ id: bid.currentVersionId }), "Bid version")
  const v1 = unwrap(
    await client.models.BidVersion.create({
      bidId: bid.id,
      projectId: bid.projectId,
      contractorId: bid.contractorId,
      clientId: bid.clientId,
      version: 1,
      status: "active",
      amount: bid.amount,
      scope: bid.proposalMessage,
      estimatedDays: bid.estimatedDays,
    }),
    "Create version 1",
  )
  const claimed = await updateIf(
    "Bid",
    { id: bid.id, currentVersionId: v1.id, currentVersion: 1 },
    { currentVersionId: { attributeExists: false } },
  )
  if (!claimed) {
    // Another request created version 1 at the same time; use theirs.
    await client.models.BidVersion.delete({ id: v1.id })
    const fresh = unwrap(await client.models.Bid.get({ id: bid.id }), "Bid")
    return unwrap(await client.models.BidVersion.get({ id: fresh.currentVersionId! }), "Bid version")
  }
  bid.currentVersionId = v1.id
  bid.currentVersion = 1
  return v1
}

/** Loads a bid and its project, checking the caller is the bid's contractor or the project's client. */
async function loadBid(bidId: string, caller: string, who: "contractor" | "client") {
  const bid = unwrap(await client.models.Bid.get({ id: bidId }), "Bid")
  const project = unwrap(await client.models.Project.get({ id: bid.projectId }), "Project")
  if (who === "contractor" && bid.contractorId !== caller) throw new Error("This isn't your bid.")
  if (who === "client" && project.clientId !== caller) {
    throw new Error("Only the client who posted this project can do that.")
  }
  return { bid, project }
}

function bidHref(bid: Bid) {
  return `/projects/${bid.projectId}/bids/${bid.id}`
}

// ---------------------------------------------------------------------------
// Bids
// ---------------------------------------------------------------------------

async function placeBid(event: Args<"placeBid">): Promise<Bid> {
  const contractorId = callerId(event)
  const { projectId, ...input } = event.arguments

  const profile = unwrap(await client.models.UserProfile.get({ userId: contractorId }), "Profile")
  if (profile.userType !== "contractor") throw new Error("Only contractor accounts can place bids.")

  const project = unwrap(await client.models.Project.get({ id: projectId }), "Project")
  if (project.status !== "open") throw new Error("This project is no longer accepting bids.")
  if (project.clientId === contractorId) throw new Error("You can't bid on your own project.")

  const terms = cleanProposal(input)

  // One live bid per contractor per project (a withdrawn bid can be replaced).
  const { data: myBids } = await client.models.Bid.listBidByContractorId({ contractorId }, { limit: 1000 })
  if (myBids.some((b) => b.projectId === projectId && b.status !== "withdrawn")) {
    throw new Error("You already placed a bid on this project. Revise it instead.")
  }

  const bid = unwrap(
    await client.models.Bid.create({
      projectId,
      contractorId,
      clientId: project.clientId, // taken from the project, not trusted from the browser
      amount: terms.amount,
      estimatedDays: terms.estimatedDays,
      proposalMessage: terms.scope,
      status: "pending",
    }),
    "Create bid",
  )
  const v1 = unwrap(
    await client.models.BidVersion.create({
      bidId: bid.id,
      projectId,
      contractorId,
      clientId: project.clientId,
      version: 1,
      status: "active",
      ...terms,
    }),
    "Create proposal",
  )
  const withVersion = unwrap(
    await client.models.Bid.update({ id: bid.id, currentVersionId: v1.id, currentVersion: 1 }),
    "Link proposal",
  )

  const contractor = await displayName(contractorId)
  await notify(
    project.clientId,
    "New bid received",
    `${contractor.businessName ?? contractor.name} bid ${money(terms.amount)} on "${project.title}".`,
    bidHref(bid),
  )
  return withVersion
}

async function reviseBid(event: Args<"reviseBid">): Promise<Bid> {
  const caller = callerId(event)
  const { bidId, expectedVersion, changeSummary, ...input } = event.arguments
  const { bid, project } = await loadBid(bidId, caller, "contractor")
  if (!OPEN_BID_STATUSES.includes(bid.status!)) throw new Error(`This bid is ${bid.status}, so it can't be revised.`)
  if (project.status !== "open") throw new Error("This project has already hired a contractor.")

  const terms = cleanProposal(input)
  const previous = await currentVersion(bid)
  if (previous.version !== expectedVersion) {
    throw new Error("Your bid changed since you opened it. Reload to see the latest version, then revise again.")
  }
  const summary = changeSummary?.trim() || null
  const next = previous.version + 1
  const nextId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Claim the new version number first, so two revisions at once can't both win.
  const claimed = await updateIf(
    "Bid",
    {
      id: bid.id,
      currentVersionId: nextId,
      currentVersion: next,
      amount: terms.amount,
      estimatedDays: terms.estimatedDays,
      proposalMessage: terms.scope,
      previousAmount: previous.amount,
      amountUpdatedAt: now,
      status: "pending",
      revisionNote: null,
      revisionRequestedAt: null,
    },
    { currentVersion: { eq: previous.version }, ...statusIn(OPEN_BID_STATUSES) },
  )
  if (!claimed) {
    throw new Error("Your bid changed while you were editing (it may have been revised, declined or accepted). Reload and try again.")
  }

  try {
    unwrap(
      await client.models.BidVersion.create({
        id: nextId,
        bidId: bid.id,
        projectId: bid.projectId,
        contractorId: bid.contractorId,
        clientId: bid.clientId,
        version: next,
        status: "active",
        changeSummary: summary,
        ...terms,
      }),
      "Save revision",
    )
  } catch (err) {
    // Point the bid back at the previous version so it never references a missing one.
    await client.models.Bid.update({
      id: bid.id,
      currentVersionId: previous.id,
      currentVersion: previous.version,
      amount: previous.amount,
      estimatedDays: previous.estimatedDays,
      proposalMessage: previous.scope,
      previousAmount: bid.previousAmount,
      status: bid.status,
    })
    throw err
  }
  await client.models.BidVersion.update({ id: previous.id, status: "superseded" })

  const priceNote =
    terms.amount === previous.amount ? money(terms.amount) : `${money(terms.amount)} (was ${money(previous.amount)})`
  await notify(
    project.clientId,
    "Revised proposal",
    `The contractor sent version ${next} of their bid on "${project.title}": ${priceNote}.`,
    bidHref(bid),
  )
  await postToConversation(
    project,
    bid.contractorId,
    bid.contractorId,
    `I sent a revised proposal (version ${next}): ${priceNote}.${summary ? ` What changed: ${summary}` : ""}`,
  )
  return unwrap(await client.models.Bid.get({ id: bid.id }), "Bid")
}

async function requestRevision(event: Args<"requestRevision">): Promise<Bid> {
  const caller = callerId(event)
  const { bidId } = event.arguments
  const note = event.arguments.note.trim()
  if (note.length < 5) throw new Error("Tell the contractor what you'd like changed (at least 5 characters).")
  if (note.length > 2000) throw new Error("That note is too long (2000 characters max).")

  const { bid, project } = await loadBid(bidId, caller, "client")
  if (project.status !== "open") throw new Error("This project has already hired a contractor.")
  if (!OPEN_BID_STATUSES.includes(bid.status!)) throw new Error(`This bid is ${bid.status}.`)

  const ok = await updateIf(
    "Bid",
    { id: bid.id, status: "revision_requested", revisionNote: note, revisionRequestedAt: new Date().toISOString() },
    statusIn(OPEN_BID_STATUSES),
  )
  if (!ok) throw new Error("This bid just changed. Reload and try again.")

  await notify(bid.contractorId, "Revision requested", `The client asked you to revise your bid on "${project.title}".`, bidHref(bid))
  await postToConversation(project, bid.contractorId, project.clientId, `Revision requested: ${note}`)
  return unwrap(await client.models.Bid.get({ id: bid.id }), "Bid")
}

async function declineBid(event: Args<"declineBid">): Promise<Bid> {
  const caller = callerId(event)
  const { bid, project } = await loadBid(event.arguments.bidId, caller, "client")
  if (project.status !== "open") throw new Error("This project has already hired a contractor.")
  if (!OPEN_BID_STATUSES.includes(bid.status!)) throw new Error(`This bid is already ${bid.status}.`)

  const ok = await updateIf("Bid", { id: bid.id, status: "rejected" }, statusIn(OPEN_BID_STATUSES))
  if (!ok) throw new Error("This bid just changed. Reload and try again.")
  await notify(bid.contractorId, "Bid declined", `The client declined your bid on "${project.title}".`, bidHref(bid))
  return unwrap(await client.models.Bid.get({ id: bid.id }), "Bid")
}

async function withdrawBid(event: Args<"withdrawBid">): Promise<Bid> {
  const caller = callerId(event)
  const { bid, project } = await loadBid(event.arguments.bidId, caller, "contractor")
  if (!OPEN_BID_STATUSES.includes(bid.status!)) throw new Error(`This bid is already ${bid.status}.`)

  const ok = await updateIf("Bid", { id: bid.id, status: "withdrawn" }, statusIn(OPEN_BID_STATUSES))
  if (!ok) throw new Error("This bid just changed (it may have been accepted). Reload to check.")
  const contractor = await displayName(bid.contractorId)
  await notify(
    project.clientId,
    "Bid withdrawn",
    `${contractor.businessName ?? contractor.name} withdrew their bid on "${project.title}".`,
    `/projects/${project.id}`,
  )
  return unwrap(await client.models.Bid.get({ id: bid.id }), "Bid")
}

// ---------------------------------------------------------------------------
// Agreement & hiring
// ---------------------------------------------------------------------------

async function confirmAgreement(event: Args<"confirmAgreement">): Promise<Agreement> {
  const caller = callerId(event)
  const { bidId, bidVersionId } = event.arguments
  const { bid, project } = await loadBid(bidId, caller, "client")

  // Pressing Confirm twice (or a retried request) returns the agreement already made.
  const { data: existing } = await client.models.Agreement.listAgreementByBidId({ bidId })
  if (existing.length) return existing[0]

  if (project.status !== "open") throw new Error("This project has already hired a contractor.")
  if (!OPEN_BID_STATUSES.includes(bid.status!)) throw new Error(`This bid is ${bid.status}, so it can't be accepted.`)

  const version = await currentVersion(bid)
  if (version.id !== bidVersionId) {
    throw new Error("The contractor revised this proposal since you reviewed it. Review the latest version before accepting.")
  }
  const missing = missingTerms(version)
  if (missing.length) {
    throw new Error(`This proposal is missing: ${missing.join(", ")}. Ask the contractor to revise it first.`)
  }

  // 1. Lock the project. Only one confirmation can move it out of "open".
  const startDate = new Date(`${version.startDate}T00:00:00Z`).toISOString()
  const locked = await updateIf(
    "Project",
    { id: project.id, status: "awarded", awardedContractorId: bid.contractorId, startDate },
    { status: { eq: "open" } },
  )
  if (!locked) throw new Error("This project has already hired a contractor.")

  const unlockProject = () =>
    updateIf(
      "Project",
      { id: project.id, status: "open", awardedContractorId: null, startDate: null },
      { awardedContractorId: { eq: bid.contractorId } },
    )

  // 2. Accept the bid, but only if it's still this exact version and still open.
  const accepted = await updateIf(
    "Bid",
    { id: bid.id, status: "accepted", revisionNote: null },
    { currentVersionId: { eq: version.id }, ...statusIn(OPEN_BID_STATUSES) },
  )
  if (!accepted) {
    await unlockProject()
    throw new Error("This bid changed while you were confirming (it may have been revised or withdrawn). Review it again.")
  }

  // 3. Record the agreement as a snapshot of the accepted version.
  let agreement: Agreement
  try {
    const contractor = await displayName(bid.contractorId)
    agreement = unwrap(
      await client.models.Agreement.create({
        projectId: project.id,
        projectTitle: project.title,
        bidId: bid.id,
        bidVersionId: version.id,
        version: version.version,
        clientId: project.clientId,
        clientName: project.clientName,
        contractorId: bid.contractorId,
        contractorName: contractor.name,
        businessName: contractor.businessName,
        confirmedAt: new Date().toISOString(),
        amount: version.amount,
        scope: version.scope,
        estimatedDays: version.estimatedDays,
        startDate: version.startDate!,
        paymentTerms: version.paymentTerms!,
        materialsCost: version.materialsCost,
        laborCost: version.laborCost,
        materialsDetail: version.materialsDetail,
        included: version.included,
        excluded: version.excluded,
        notes: version.notes,
      }),
      "Record agreement",
    )
  } catch (err) {
    await updateIf("Bid", { id: bid.id, status: bid.status }, { status: { eq: "accepted" } })
    await unlockProject()
    throw err
  }

  // 4. Freeze the accepted version and close every other open bid.
  await client.models.BidVersion.update({ id: version.id, status: "accepted" })
  const { data: projectBids } = await client.models.Bid.listBidByProjectId({ projectId: project.id }, { limit: 1000 })
  const others = projectBids.filter((b) => b.id !== bid.id && OPEN_BID_STATUSES.includes(b.status!))
  await Promise.all(
    others.map(async (b) => {
      if (await updateIf("Bid", { id: b.id, status: "closed" }, statusIn(OPEN_BID_STATUSES))) {
        await notify(
          b.contractorId,
          "Project closed",
          `"${project.title}" hired another contractor and is no longer accepting bids.`,
          `/projects/${project.id}`,
        )
      }
    }),
  )

  await notify(
    bid.contractorId,
    "You're hired!",
    `The client confirmed your proposal for "${project.title}" at ${money(version.amount)}.`,
    `/projects/${project.id}`,
  )
  return agreement
}

async function completeProject(event: Args<"completeProject">): Promise<Project> {
  const caller = callerId(event)
  const project = unwrap(await client.models.Project.get({ id: event.arguments.projectId }), "Project")
  if (project.clientId !== caller) throw new Error("Only the client who posted this project can complete it.")
  const ok = await updateIf(
    "Project",
    { id: project.id, status: "completed", completionDate: new Date().toISOString() },
    statusIn(["awarded", "in_progress"]),
  )
  if (!ok) throw new Error("Only a hired project can be marked complete.")
  if (project.awardedContractorId) {
    await notify(project.awardedContractorId, "Project completed", `The client marked "${project.title}" complete.`, `/projects/${project.id}`)
  }
  return unwrap(await client.models.Project.get({ id: project.id }), "Project")
}

// ---------------------------------------------------------------------------
// Change orders
// ---------------------------------------------------------------------------

async function proposeChangeOrder(event: Args<"proposeChangeOrder">): Promise<ChangeOrder> {
  const caller = callerId(event)
  const { agreementId, amountChange, daysChange } = event.arguments
  const description = event.arguments.description.trim()

  const agreement = unwrap(await client.models.Agreement.get({ id: agreementId }), "Agreement")
  if (caller !== agreement.clientId && caller !== agreement.contractorId) {
    throw new Error("Only the client and contractor on this agreement can propose changes.")
  }
  const project = unwrap(await client.models.Project.get({ id: agreement.projectId }), "Project")
  if (project.status !== "awarded" && project.status !== "in_progress") {
    throw new Error("Changes can only be proposed while the project is active.")
  }
  if (description.length < 5) throw new Error("Describe the change (at least 5 characters).")
  if (description.length > 2000) throw new Error("That description is too long (2000 characters max).")
  if (!Number.isFinite(amountChange) || Math.abs(amountChange) > 100_000_000) throw new Error("Enter a valid price change.")
  if (!Number.isInteger(daysChange) || Math.abs(daysChange) > 3650) throw new Error("Enter a whole number of days.")

  // The price can't drop to $0 or below once approved changes are counted.
  const { data: orders } = await client.models.ChangeOrder.listChangeOrderByProjectId({ projectId: project.id })
  const approvedTotal = orders.filter((o) => o.status === "approved").reduce((sum, o) => sum + o.amountChange, 0)
  if (agreement.amount + approvedTotal + amountChange <= 0) throw new Error("That would bring the total price to $0 or less.")

  const order = unwrap(
    await client.models.ChangeOrder.create({
      agreementId,
      projectId: project.id,
      clientId: agreement.clientId,
      contractorId: agreement.contractorId,
      proposedBy: caller,
      description,
      amountChange,
      daysChange,
      status: "proposed",
    }),
    "Propose change",
  )
  const other = caller === agreement.clientId ? agreement.contractorId : agreement.clientId
  await notify(other, "Change order proposed", `A change to "${project.title}" needs your approval.`, `/projects/${project.id}`)
  return order
}

async function respondToChangeOrder(event: Args<"respondToChangeOrder">): Promise<ChangeOrder> {
  const caller = callerId(event)
  const { changeOrderId, approve } = event.arguments
  const order = unwrap(await client.models.ChangeOrder.get({ id: changeOrderId }), "Change order")
  if (caller !== order.clientId && caller !== order.contractorId) throw new Error("This isn't your change order.")
  if (caller === order.proposedBy) throw new Error("The other party has to approve a change you proposed.")

  const ok = await updateIf(
    "ChangeOrder",
    { id: order.id, status: approve ? "approved" : "declined", respondedAt: new Date().toISOString() },
    { status: { eq: "proposed" } },
  )
  if (!ok) throw new Error("This change order was already answered.")
  const project = unwrap(await client.models.Project.get({ id: order.projectId }), "Project")
  await notify(
    order.proposedBy,
    approve ? "Change order approved" : "Change order declined",
    `Your proposed change to "${project.title}" was ${approve ? "approved" : "declined"}.`,
    `/projects/${project.id}`,
  )
  return unwrap(await client.models.ChangeOrder.get({ id: order.id }), "Change order")
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

async function startConversation(event: Args<"startConversation">): Promise<Conversation> {
  const caller = callerId(event)
  const { projectId, contractorId } = event.arguments

  const project = unwrap(await client.models.Project.get({ id: projectId }), "Project")
  if (caller !== project.clientId && caller !== contractorId) {
    throw new Error("Only the project's client or the contractor can start this conversation.")
  }
  // The two are only connected if the contractor bid on this project.
  const { data: projectBids } = await client.models.Bid.listBidByProjectId({ projectId }, { limit: 1000 })
  if (!projectBids.some((b) => b.contractorId === contractorId)) {
    throw new Error("You can only message about a project the contractor has bid on.")
  }
  return findOrCreateConversation(project, contractorId)
}

// ---------------------------------------------------------------------------

const operations: Record<Operation, (event: never) => Promise<unknown>> = {
  placeBid,
  reviseBid,
  requestRevision,
  declineBid,
  withdrawBid,
  confirmAgreement,
  completeProject,
  proposeChangeOrder,
  respondToChangeOrder,
  startConversation,
}

export const handler = async (event: { fieldName?: string; info?: { fieldName?: string } }) => {
  // Amplify puts the mutation name at the top level of the event ("fieldName"),
  // not under event.info like a plain AppSync Lambda resolver.
  const fieldName = event.fieldName ?? event.info?.fieldName
  const operation = operations[fieldName as Operation]
  if (!operation) throw new Error(`Unknown operation: ${fieldName}`)
  return operation(event as never)
}
