/**
 * End-to-end test of the bidding → negotiation → agreement → hiring workflow, run against
 * your Amplify sandbox with three real (test) accounts.
 *
 * Setup: create .env.test.local (gitignored) with
 *   TEST_CLIENT_EMAIL=...        TEST_CLIENT_PASSWORD=...
 *   TEST_CONTRACTOR1_EMAIL=...   TEST_CONTRACTOR1_PASSWORD=...
 *   TEST_CONTRACTOR2_EMAIL=...   TEST_CONTRACTOR2_PASSWORD=...
 * The client account must be a client; both contractors must be contractor accounts.
 *
 * Run: pnpm test:workflow
 *
 * It creates two test projects (titled "[workflow test] …") and deletes them at the end.
 * Bids, versions and agreements can only be removed by the backend, so those stay behind.
 */
import { Amplify } from "aws-amplify"
import { fetchAuthSession, signIn, signOut } from "aws-amplify/auth"
import { generateClient } from "aws-amplify/data"
import outputs from "../amplify_outputs.json" with { type: "json" }

Amplify.configure(outputs)
const client = generateClient()

const accounts = {
  client: { email: process.env.TEST_CLIENT_EMAIL, password: process.env.TEST_CLIENT_PASSWORD },
  contractor1: { email: process.env.TEST_CONTRACTOR1_EMAIL, password: process.env.TEST_CONTRACTOR1_PASSWORD },
  contractor2: { email: process.env.TEST_CONTRACTOR2_EMAIL, password: process.env.TEST_CONTRACTOR2_PASSWORD },
}
for (const [name, a] of Object.entries(accounts)) {
  if (!a.email || !a.password) {
    console.error(`Missing login for ${name}. See the setup notes at the top of scripts/workflow-test.mjs.`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

let passed = 0
const failures = []
const ids = {}
let currentUser = ""

function check(name, condition, detail = "") {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(`${name}${detail ? ` (${detail})` : ""}`)
    console.log(`  ✗ ${name}${detail ? ` (${detail})` : ""}`)
  }
}

/** Calls the API; returns { data, error } where error is the first error message. */
async function call(promise) {
  try {
    const { data, errors } = await promise
    return { data, error: errors?.length ? errors.map((e) => e.message).join("; ") : data == null ? "no data" : "" }
  } catch (err) {
    const errors = err?.errors
    return { data: null, error: errors?.length ? errors.map((e) => e.message).join("; ") : String(err?.message ?? err) }
  }
}

async function expectOk(name, promise) {
  const result = await call(promise)
  check(name, !result.error, result.error)
  return result.data
}

async function expectFail(name, promise, pattern) {
  const result = await call(promise)
  const ok = !!result.error && (!pattern || pattern.test(result.error))
  check(name, ok, result.error ? `error: ${result.error}` : "it succeeded but should have been refused")
  return result
}

async function as(name) {
  if (currentUser === name) return
  await signOut()
  const { email, password } = accounts[name]
  const { isSignedIn, nextStep } = await signIn({ username: email, password })
  if (!isSignedIn) throw new Error(`Couldn't sign in as ${name} (next step: ${nextStep?.signInStep})`)
  const session = await fetchAuthSession()
  ids[name] = session.tokens.idToken.payload.sub
  currentUser = name
}

function section(title) {
  console.log(`\n${title}`)
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
}

function proposal(amount, extra = {}) {
  return {
    amount,
    scope: "Replace porch flooring boards and repaint the porch.",
    estimatedDays: 7,
    startDate: daysFromNow(14),
    paymentTerms: "30% deposit, remainder on completion",
    materialsCost: amount * 0.4,
    laborCost: amount * 0.6,
    materialsDetail: "Pressure-treated pine, exterior paint",
    included: ["Demolition", "New flooring", "Two coats of paint"],
    excluded: ["Permit fees"],
    notes: "Assumes joists are sound.",
    ...extra,
  }
}

async function getBid(id) {
  return (await call(client.models.Bid.get({ id }))).data
}

// ---------------------------------------------------------------------------
// The workflow
// ---------------------------------------------------------------------------

const createdProjects = []

async function run() {
  section("1. Client posts a project")
  await as("client")
  const project = await expectOk(
    "client creates a project",
    client.models.Project.create({
      clientId: ids.client,
      clientName: "Workflow Test Client",
      categoryId: "general",
      title: "[workflow test] Porch renovation",
      description: "Replace the porch flooring and repaint. Test project created by workflow-test.mjs.",
      location: "Test City",
      budgetMin: 3000,
      budgetMax: 6000,
      timeline: "Within a month",
      status: "open",
    }),
  )
  if (!project) throw new Error("Can't continue without a project.")
  createdProjects.push(project.id)
  await expectFail(
    "client can't mark their own project hired directly",
    client.models.Project.update({ id: project.id, status: "awarded" }),
  )

  section("2. Two contractors bid")
  await as("contractor1")
  const bid1 = await expectOk("contractor 1 places a bid", client.mutations.placeBid({ projectId: project.id, ...proposal(4500) }))
  check("bid starts as Submitted (pending), version 1", bid1?.status === "pending" && bid1?.currentVersion === 1)
  await expectFail(
    "contractor 1 can't bid twice",
    client.mutations.placeBid({ projectId: project.id, ...proposal(4000) }),
    /already placed a bid/i,
  )
  await expectFail(
    "a bid without payment terms is refused",
    client.mutations.placeBid({ projectId: project.id, ...proposal(4000, { paymentTerms: " " }) }),
  )
  await as("contractor2")
  const bid2 = await expectOk("contractor 2 places a bid", client.mutations.placeBid({ projectId: project.id, ...proposal(5200) }))
  const c2SeesBid1 = await call(client.models.Bid.get({ id: bid1.id }))
  check("contractor 2 can't see contractor 1's bid", !c2SeesBid1.data)

  section("3. Negotiation")
  await expectFail(
    "a contractor can't request revisions",
    client.mutations.requestRevision({ bidId: bid1.id, note: "Please lower it." }),
    /only the client/i,
  )
  await as("client")
  const requested = await expectOk(
    "client requests a revision",
    client.mutations.requestRevision({ bidId: bid1.id, note: "Can you also replace the damaged railings?" }),
  )
  check("bid shows Revision requested with the note", requested?.status === "revision_requested" && !!requested?.revisionNote)
  await expectFail(
    "client can't revise a contractor's bid",
    client.mutations.reviseBid({ bidId: bid1.id, expectedVersion: 1, ...proposal(1) }),
    /isn't your bid/i,
  )

  section("4. Contractor revises (version 2)")
  await as("contractor2")
  await expectFail(
    "another contractor can't revise it",
    client.mutations.reviseBid({ bidId: bid1.id, expectedVersion: 1, ...proposal(4000) }),
    /isn't your bid/i,
  )
  await as("contractor1")
  const revised = await expectOk(
    "contractor 1 revises to $4,900",
    client.mutations.reviseBid({
      bidId: bid1.id,
      expectedVersion: 1,
      changeSummary: "Added railing replacement",
      ...proposal(4900, { included: ["Demolition", "New flooring", "Two coats of paint", "Railing replacement"] }),
    }),
  )
  check(
    "bid is version 2 at $4,900, previous $4,500, back to Submitted",
    revised?.currentVersion === 2 && revised?.amount === 4900 && revised?.previousAmount === 4500 && revised?.status === "pending",
  )
  await expectFail(
    "a stale revision (based on version 1) is refused",
    client.mutations.reviseBid({ bidId: bid1.id, expectedVersion: 1, ...proposal(4800) }),
    /changed/i,
  )
  const versions = await expectOk(
    "contractor reads the version history",
    client.models.BidVersion.listBidVersionByBidIdAndVersion({ bidId: bid1.id }),
  )
  const v1 = versions?.find((v) => v.version === 1)
  const v2 = versions?.find((v) => v.version === 2)
  check("history has v1 (superseded) and v2 (active)", v1?.status === "superseded" && v2?.status === "active")
  await as("contractor2")
  const peek = await call(client.models.BidVersion.listBidVersionByBidIdAndVersion({ bidId: bid1.id }))
  check("another contractor can't read the versions", !peek.data?.length)

  section("5. Accepting")
  await as("client")
  await expectFail(
    "accepting the superseded version 1 is refused",
    client.mutations.confirmAgreement({ bidId: bid1.id, bidVersionId: v1.id }),
    /revised/i,
  )
  await as("contractor1")
  await expectFail(
    "a contractor can't confirm an agreement",
    client.mutations.confirmAgreement({ bidId: bid1.id, bidVersionId: v2.id }),
    /only the client/i,
  )

  await as("client")
  const bid2Fresh = await getBid(bid2.id)
  console.log("  … confirming both bids at the same moment")
  const race = await Promise.all([
    call(client.mutations.confirmAgreement({ bidId: bid1.id, bidVersionId: v2.id })),
    call(client.mutations.confirmAgreement({ bidId: bid2.id, bidVersionId: bid2Fresh.currentVersionId })),
  ])
  const winners = race.filter((r) => !r.error)
  check("exactly one simultaneous confirmation wins", winners.length === 1, race.map((r) => r.error || "ok").join(" | "))
  const winnerIndex = race.findIndex((r) => !r.error)
  const winnerBid = winnerIndex === 0 ? bid1 : bid2
  const loserBid = winnerIndex === 0 ? bid2 : bid1
  const winnerName = winnerIndex === 0 ? "contractor1" : "contractor2"
  const loserName = winnerIndex === 0 ? "contractor2" : "contractor1"
  const agreement = race[winnerIndex]?.data
  if (!agreement) throw new Error("No agreement was created; can't continue.")

  const again = await expectOk(
    "confirming twice returns the same agreement",
    client.mutations.confirmAgreement({ bidId: winnerBid.id, bidVersionId: agreement.bidVersionId }),
  )
  check("…with the same id", again?.id === agreement.id)

  const hiredProject = (await call(client.models.Project.get({ id: project.id }))).data
  check("project is Hired (awarded) to the winner", hiredProject?.status === "awarded" && hiredProject?.awardedContractorId === ids[winnerName])
  check("winning bid is accepted", (await getBid(winnerBid.id))?.status === "accepted")
  check("the other bid is closed", (await getBid(loserBid.id))?.status === "closed")
  check(
    "agreement snapshot matches the accepted version",
    agreement.amount === (winnerIndex === 0 ? 4900 : 5200) && agreement.paymentTerms === "30% deposit, remainder on completion",
  )
  await expectFail(
    "a hired project can't be marked hired again via another bid",
    client.mutations.confirmAgreement({ bidId: loserBid.id, bidVersionId: (await getBid(loserBid.id)).currentVersionId }),
  )

  section("6. After hiring")
  await as(loserName)
  await expectFail(
    "the losing contractor can't revise their closed bid",
    client.mutations.reviseBid({ bidId: loserBid.id, expectedVersion: (await getBid(loserBid.id))?.currentVersion ?? 1, ...proposal(3000) }),
  )
  const loserAgreement = await call(client.models.Agreement.listAgreementByProjectId({ projectId: project.id }))
  check("the losing contractor can't read the agreement", !loserAgreement.data?.length)
  const loserNotes = await call(client.models.Notification.listNotificationByUserId({ userId: ids[loserName] }))
  check("the losing contractor was notified", loserNotes.data?.some((n) => /no longer accepting/i.test(n.body)))
  await as(winnerName)
  const winnerNotes = await call(client.models.Notification.listNotificationByUserId({ userId: ids[winnerName] }))
  check("the hired contractor was notified", winnerNotes.data?.some((n) => /hired/i.test(n.title)))
  await expectFail(
    "nobody can bid on a hired project",
    client.mutations.placeBid({ projectId: project.id, ...proposal(100) }),
  )

  section("7. Change orders")
  const order = await expectOk(
    "hired contractor proposes a change order",
    client.mutations.proposeChangeOrder({ agreementId: agreement.id, description: "Add stain to the steps", amountChange: 300, daysChange: 1 }),
  )
  await expectFail(
    "they can't approve their own change",
    client.mutations.respondToChangeOrder({ changeOrderId: order.id, approve: true }),
    /other party/i,
  )
  await as(loserName)
  await expectFail(
    "an outsider can't propose changes",
    client.mutations.proposeChangeOrder({ agreementId: agreement.id, description: "Sneaky change", amountChange: -4000, daysChange: 0 }),
  )
  await as("client")
  const approved = await expectOk("client approves it", client.mutations.respondToChangeOrder({ changeOrderId: order.id, approve: true }))
  check("change order is approved", approved?.status === "approved")
  await expectFail(
    "it can't be answered twice",
    client.mutations.respondToChangeOrder({ changeOrderId: order.id, approve: false }),
    /already answered/i,
  )
  const unchanged = (await call(client.models.Agreement.get({ id: agreement.id }))).data
  check("the original agreement is unchanged", unchanged?.amount === agreement.amount)
  await expectFail("client can't edit the agreement", client.models.Agreement.update({ id: agreement.id, amount: 1 }))

  section("8. Withdrawing")
  const project2 = await expectOk(
    "client posts a second project",
    client.models.Project.create({
      clientId: ids.client,
      clientName: "Workflow Test Client",
      categoryId: "general",
      title: "[workflow test] Fence repair",
      description: "Repair a section of fence. Test project created by workflow-test.mjs.",
      location: "Test City",
      budgetMin: 500,
      budgetMax: 1500,
      status: "open",
    }),
  )
  createdProjects.push(project2.id)
  await as("contractor2")
  const bid3 = await expectOk("contractor 2 bids", client.mutations.placeBid({ projectId: project2.id, ...proposal(900) }))
  const withdrawn = await expectOk("contractor 2 withdraws it", client.mutations.withdrawBid({ bidId: bid3.id }))
  check("bid is withdrawn", withdrawn?.status === "withdrawn")
  await as("client")
  await expectFail(
    "a withdrawn bid can't be accepted",
    client.mutations.confirmAgreement({ bidId: bid3.id, bidVersionId: bid3.currentVersionId }),
  )
  await expectFail("a withdrawn bid can't be declined", client.mutations.declineBid({ bidId: bid3.id }))
  await as("contractor2")
  await expectOk("contractor 2 can bid again after withdrawing", client.mutations.placeBid({ projectId: project2.id, ...proposal(850) }))

  section("9. Completing")
  await as(winnerName)
  await expectFail("the contractor can't mark the project complete", client.mutations.completeProject({ projectId: project.id }))
  await as("client")
  const completed = await expectOk("client marks it complete", client.mutations.completeProject({ projectId: project.id }))
  check("project is completed", completed?.status === "completed")
}

// Clients can't delete projects: the server-managed status fields block deletes, which also
// keeps hired projects and their agreements from disappearing. Test projects stay in the
// sandbox, marked "[workflow test]" in their titles.
function cleanup() {
  if (!createdProjects.length) return
  section("Test data")
  for (const id of createdProjects) console.log(`  left test project ${id} in the sandbox`)
}

try {
  await run()
} catch (err) {
  failures.push(`stopped early: ${err.message}`)
  console.log(`\n✗ Stopped early: ${err.message}`)
} finally {
  cleanup()
  await signOut()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"))
  process.exit(1)
}
