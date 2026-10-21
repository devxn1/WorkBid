"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Hub } from "aws-amplify/utils"
import { generateClient } from "aws-amplify/data"
import type { Schema } from "@/amplify/data/resource"
import { loadAuthUser, type AuthUser } from "./auth"
import {
  clientNotifications as seedClientNotifs,
  contractorNotifications as seedContractorNotifs,
  contractors as seedContractors,
  CURRENT_CLIENT_ID,
  CURRENT_CONTRACTOR_ID,
  CLIENT_USER,
  CONTRACTOR_USER,
  reviews as seedReviews,
} from "./mock-data"
import type {
  AppNotification,
  Bid,
  Contractor,
  Conversation,
  Message,
  Project,
  Review,
  User,
  UserType,
} from "./types"

interface NewProjectInput {
  title: string
  description: string
  categoryId: string
  location: string
  budgetMin: number
  budgetMax: number
  images: string[]
}

/** Project fields the owner can change while the project is open. */
type ProjectDetailsInput = Omit<NewProjectInput, "images"> & { images?: string[] }

interface NewBidInput {
  amount: number
  estimatedDays: number
  proposalMessage: string
}

type BidChangesInput = Omit<NewBidInput, "proposalMessage">

interface MarketplaceContextValue {
  /** The real signed-in user (null when signed out). */
  authUser: AuthUser | null
  /** True until we've checked whether someone is signed in. */
  authLoading: boolean
  /** Re-reads the signed-in user (after sign-in or a profile edit). */
  refreshAuthUser: () => Promise<AuthUser | null>
  role: UserType
  setRole: (role: UserType) => void
  currentUser: User
  currentClientId: string
  currentContractorId: string
  projects: Project[]
  /** True until projects have been loaded from the database. */
  projectsLoading: boolean
  bids: Bid[]
  contractors: Contractor[]
  reviews: Review[]
  conversations: Conversation[]
  messages: Message[]
  notifications: AppNotification[]
  unreadCount: number
  // actions
  addProject: (input: NewProjectInput) => Promise<Project>
  updateProjectDetails: (projectId: string, input: ProjectDetailsInput) => Promise<Project>
  addBid: (projectId: string, input: NewBidInput) => Promise<void>
  /** Changes the amount/timeline of your own pending bid. Throws with a readable message on failure. */
  updateBid: (bidId: string, input: BidChangesInput) => Promise<void>
  acceptBid: (bidId: string) => Promise<void>
  rejectBid: (bidId: string) => Promise<void>
  completeProject: (projectId: string) => void
  addReview: (projectId: string, rating: number, reviewText: string) => void
  /** Sends a message. Throws with a readable message on failure. */
  sendMessage: (conversationId: string, body: string) => Promise<void>
  /** Opens (or finds) the conversation for a project and contractor; returns its id. Throws on failure. */
  startConversation: (projectId: string, contractorId: string) => Promise<string>
  markNotificationsRead: () => void
  // helpers
  getContractor: (id: string) => Contractor | undefined
  getProject: (id: string) => Project | undefined
  getBidsForProject: (projectId: string) => Bid[]
  getBidsByContractor: (contractorId: string) => Bid[]
  getReviewsForContractor: (contractorId: string) => Review[]
  getMessagesForConversation: (conversationId: string) => Message[]
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null)

type ProjectRow = Schema["Project"]["type"]
type BidRow = Schema["Bid"]["type"]
type ConversationRow = Schema["Conversation"]["type"]
type MessageRow = Schema["Message"]["type"]

/** A conversation as stored; the project's status is added from the loaded projects. */
type ConversationInfo = Omit<Conversation, "projectStatus"> & { createdAt: string }

function toConversation(row: ConversationRow): ConversationInfo {
  return {
    conversationId: row.id,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    clientId: row.clientId,
    clientName: row.clientName,
    contractorId: row.contractorId,
    contractorName: row.contractorName,
    contractorAvatar: row.contractorAvatar ?? "",
    createdAt: row.createdAt,
  }
}

function toMessage(row: MessageRow): Message {
  return {
    messageId: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.senderName,
    receiverId: row.receiverId,
    messageBody: row.messageBody,
    sentAt: row.sentAt,
  }
}

/**
 * True if a message is really between the conversation's two people. Anyone can write a
 * Message row naming any conversation, so this drops messages slipped in by outsiders.
 */
function isBetweenParticipants(message: Message, conv: ConversationInfo) {
  const people = [conv.clientId, conv.contractorId]
  return (
    message.senderId !== message.receiverId && people.includes(message.senderId) && people.includes(message.receiverId)
  )
}

/** Reads every page of a list query. */
async function listAll<T>(
  fetchPage: (nextToken: string | null | undefined) => Promise<{
    data: T[]
    errors?: { message: string }[]
    nextToken?: string | null
  }>,
) {
  const rows: T[] = []
  let nextToken: string | null | undefined
  do {
    const page = await fetchPage(nextToken)
    if (page.errors?.length) throw new Error(page.errors[0].message)
    rows.push(...page.data)
    nextToken = page.nextToken
  } while (nextToken)
  return rows
}

/** Converts a database Bid row into the shape the pages use. */
function toBid(row: BidRow): Bid {
  return {
    bidId: row.id,
    projectId: row.projectId,
    contractorId: row.contractorId,
    amount: row.amount,
    estimatedDays: row.estimatedDays,
    proposalMessage: row.proposalMessage,
    bidDate: row.createdAt,
    status: row.status ?? "pending",
    amountUpdatedAt: row.amountUpdatedAt ?? undefined,
  }
}

/** Contractor details loaded from the database (profile fields only; stats are calculated). */
type ContractorInfo = Omit<Contractor, "rating" | "reviewCount" | "completedProjects">

/** Converts a database Project row into the shape the pages use. */
function toProject(row: ProjectRow): Project {
  return {
    projectId: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    location: row.location,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    status: row.status ?? "open",
    createdAt: row.createdAt,
    startDate: row.startDate ?? undefined,
    completionDate: row.completionDate ?? undefined,
    images: (row.images ?? []).filter((i): i is string => !!i),
    awardedContractorId: row.awardedContractorId ?? undefined,
  }
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  // Signed-in users get their real role; the mock role only applies while signed out.
  const [mockRole, setRole] = useState<UserType>("client")
  const role = authUser?.userType ?? mockRole
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  // Bids are still in-memory until they move to the database; the sample bids pointed at
  // sample projects that no longer exist, so start empty.
  const [bids, setBids] = useState<Bid[]>([])
  // Real contractors (by Cognito user id), loaded from ContractorProfile/UserProfile as needed.
  const [contractorInfo, setContractorInfo] = useState<Record<string, ContractorInfo>>({})
  const requestedContractors = useRef(new Set<string>())
  const [reviews, setReviews] = useState<Review[]>(seedReviews)
  const [conversationRows, setConversationRows] = useState<ConversationInfo[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [clientNotifs, setClientNotifs] = useState<AppNotification[]>(seedClientNotifs)
  const [contractorNotifs, setContractorNotifs] = useState<AppNotification[]>(seedContractorNotifs)

  // Share one in-flight request so simultaneous callers don't create the profile twice.
  const authRequest = useRef<Promise<AuthUser | null> | null>(null)
  const refreshAuthUser = useCallback(() => {
    if (!authRequest.current) {
      authRequest.current = loadAuthUser()
        .catch((err) => {
          console.error("Failed to load signed-in user", err)
          return null
        })
        .then((user) => {
          setAuthUser(user)
          setAuthLoading(false)
          return user
        })
        .finally(() => {
          authRequest.current = null
        })
    }
    return authRequest.current
  }, [])

  useEffect(() => {
    refreshAuthUser()
    // Clear the user when they sign out (in this tab or another).
    return Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedOut") setAuthUser(null)
    })
  }, [refreshAuthUser])

  // Switches the color theme (contractors are orange, see app/globals.css). It's set on
  // <html> so dialogs and menus, which render outside the page, pick it up too.
  useEffect(() => {
    document.documentElement.dataset.role = role
  }, [role])

  // Load every project from the database. Signed-out visitors read as guests
  // ("identityPool"); signed-in users read with their login ("userPool").
  const signedInUserId = authUser?.userId
  const loadProjects = useCallback(async () => {
    const client = generateClient<Schema>()
    const authMode = signedInUserId ? "userPool" : "identityPool"
    const rows: ProjectRow[] = []
    let nextToken: string | null | undefined
    try {
      do {
        const page = await client.models.Project.list({ authMode, limit: 100, nextToken })
        if (page.errors?.length) throw new Error(page.errors[0].message)
        rows.push(...page.data)
        nextToken = page.nextToken
      } while (nextToken)
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setProjects(rows.map(toProject))
    } catch (err) {
      console.error("Failed to load projects", err)
      toast.error("Couldn't load projects", { description: "Refresh the page to try again." })
    } finally {
      setProjectsLoading(false)
    }
  }, [signedInUserId])

  useEffect(() => {
    if (!authLoading) loadProjects()
  }, [authLoading, loadProjects])

  // Bids: the database only returns the ones you're allowed to see —
  // contractors get their own bids, clients get bids on their projects.
  const loadBids = useCallback(async () => {
    if (!signedInUserId) {
      setBids([])
      return
    }
    const client = generateClient<Schema>()
    const rows: BidRow[] = []
    let nextToken: string | null | undefined
    try {
      do {
        const page = await client.models.Bid.list({ limit: 100, nextToken })
        if (page.errors?.length) throw new Error(page.errors[0].message)
        rows.push(...page.data)
        nextToken = page.nextToken
      } while (nextToken)
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setBids(rows.map(toBid))
    } catch (err) {
      console.error("Failed to load bids", err)
    }
  }, [signedInUserId])

  useEffect(() => {
    if (!authLoading) loadBids()
  }, [authLoading, loadBids])

  // Live bid changes (a new amount, or accepted/declined) for bids you can see.
  useEffect(() => {
    if (!signedInUserId) return
    const client = generateClient<Schema>()
    const subscription = client.models.Bid.onUpdate().subscribe({
      next: (row) => {
        const updated = toBid(row)
        setBids((prev) => prev.map((b) => (b.bidId === updated.bidId ? updated : b)))
      },
      error: (err) => console.error("Live bid updates stopped", err),
    })
    return () => subscription.unsubscribe()
  }, [signedInUserId])

  // Load names/business info for every contractor we need to show (bidders, awarded
  // contractors, and yourself if you're a contractor).
  useEffect(() => {
    const ids = new Set<string>()
    bids.forEach((b) => ids.add(b.contractorId))
    projects.forEach((p) => p.awardedContractorId && ids.add(p.awardedContractorId))
    if (authUser?.userType === "contractor") ids.add(authUser.userId)
    const missing = [...ids].filter(
      (id) => !requestedContractors.current.has(id) && !seedContractors.some((c) => c.contractorId === id),
    )
    if (missing.length === 0) return
    missing.forEach((id) => requestedContractors.current.add(id))

    const client = generateClient<Schema>()
    const authMode = signedInUserId ? "userPool" : "identityPool"
    Promise.all(
      missing.map(async (id): Promise<[string, ContractorInfo]> => {
        const [{ data: cp }, user] = await Promise.all([
          client.models.ContractorProfile.get({ contractorId: id }, { authMode }),
          // Guests can't read UserProfile; that's fine, ContractorProfile has the name.
          signedInUserId ? client.models.UserProfile.get({ userId: id }).then((r) => r.data) : Promise.resolve(null),
        ])
        const personName = user ? `${user.firstName} ${user.lastName}`.trim() : ""
        return [
          id,
          {
            contractorId: id,
            userId: id,
            businessName: cp?.businessName || personName || "Contractor",
            contractorName: cp?.contractorName || personName || "Contractor",
            licenseNumber: cp?.licenseNumber ?? "",
            yearsExperience: cp?.yearsExperience ?? 0,
            location: cp?.location ?? "",
            specialty: cp?.specialty ?? "",
            verified: false,
            avatar: cp?.avatar ?? user?.avatar ?? "",
            about: cp?.about ?? "",
            skills: (cp?.skills ?? []).filter((x): x is string => !!x),
            services: (cp?.services ?? []).filter((x): x is string => !!x),
          },
        ]
      }),
    )
      .then((entries) => setContractorInfo((prev) => ({ ...prev, ...Object.fromEntries(entries) })))
      .catch((err) => {
        missing.forEach((id) => requestedContractors.current.delete(id))
        console.error("Failed to load contractor info", err)
      })
  }, [bids, projects, authUser, signedInUserId])

  // Conversations and their messages. The database only returns the ones you're part of.
  const signedInUserType = authUser?.userType
  const loadConversations = useCallback(async () => {
    if (!signedInUserId) {
      setConversationRows([])
      setMessages([])
      return
    }
    const client = generateClient<Schema>()
    try {
      const rows =
        signedInUserType === "client"
          ? await listAll((nextToken) =>
              client.models.Conversation.listConversationByClientId({ clientId: signedInUserId }, { nextToken }),
            )
          : await listAll((nextToken) =>
              client.models.Conversation.listConversationByContractorId(
                { contractorId: signedInUserId },
                { nextToken },
              ),
            )
      const convs = rows.map(toConversation)
      const threads = await Promise.all(
        convs.map(async (conv) => {
          const msgRows = await listAll((nextToken) =>
            client.models.Message.listMessageByConversationIdAndSentAt(
              { conversationId: conv.conversationId },
              { nextToken },
            ),
          )
          return msgRows.map(toMessage).filter((m) => isBetweenParticipants(m, conv))
        }),
      )
      setConversationRows(convs)
      setMessages(threads.flat())
    } catch (err) {
      console.error("Failed to load conversations", err)
    }
  }, [signedInUserId, signedInUserType])

  useEffect(() => {
    if (!authLoading) loadConversations()
  }, [authLoading, loadConversations])

  /** Adds a message to the local list (skipping duplicates: you also receive your own sends live). */
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => (prev.some((m) => m.messageId === message.messageId) ? prev : [...prev, message]))
  }, [])

  // Live updates: new messages to or from you arrive here without a refresh.
  const conversationsRef = useRef(conversationRows)
  useEffect(() => {
    conversationsRef.current = conversationRows
  }, [conversationRows])
  useEffect(() => {
    if (!signedInUserId) return
    const client = generateClient<Schema>()
    const subscription = client.models.Message.onCreate().subscribe({
      next: (row) => {
        const message = toMessage(row)
        const conv = conversationsRef.current.find((c) => c.conversationId === message.conversationId)
        // First message in a conversation someone else just opened: reload to get it.
        if (!conv) loadConversations()
        else if (isBetweenParticipants(message, conv)) addMessage(message)
      },
      error: (err) => console.error("Live message updates stopped", err),
    })
    return () => subscription.unsubscribe()
  }, [signedInUserId, loadConversations, addMessage])

  // Newest activity first, with each project's current status.
  const conversations = useMemo<Conversation[]>(() => {
    const lastActivity = new Map<string, string>()
    conversationRows.forEach((c) => lastActivity.set(c.conversationId, c.createdAt))
    messages.forEach((m) => {
      if (m.sentAt > (lastActivity.get(m.conversationId) ?? "")) lastActivity.set(m.conversationId, m.sentAt)
    })
    return conversationRows
      .map(({ createdAt: _createdAt, ...c }) => ({
        ...c,
        projectStatus: projects.find((p) => p.projectId === c.projectId)?.status ?? "open",
      }))
      .sort((a, b) =>
        (lastActivity.get(b.conversationId) ?? "").localeCompare(lastActivity.get(a.conversationId) ?? ""),
      )
  }, [conversationRows, messages, projects])

  /** Saves changes to a project the signed-in client owns and updates the local copy. */
  const updateProjectInDb = useCallback(
    async (projectId: string, changes: Partial<Pick<ProjectRow, "status" | "awardedContractorId" | "startDate" | "completionDate">>) => {
      const client = generateClient<Schema>()
      const { data, errors } = await client.models.Project.update({ id: projectId, ...changes })
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't update the project.")
      const updated = toProject(data)
      setProjects((prev) => prev.map((p) => (p.projectId === projectId ? updated : p)))
      return updated
    },
    [],
  )

  const currentUser: User = authUser
    ? {
        userId: authUser.userId,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        email: authUser.email,
        userType: authUser.userType,
        avatar: authUser.avatar ?? "",
      }
    : role === "client"
      ? CLIENT_USER
      : CONTRACTOR_USER
  const notifications = role === "client" ? clientNotifs : contractorNotifs
  const unreadCount = notifications.filter((n) => !n.read).length

  const getContractor = useCallback(
    (id: string): Contractor | undefined => {
      const info = contractorInfo[id]
      if (!info) return seedContractors.find((c) => c.contractorId === id)
      const theirReviews = reviews.filter((r) => r.contractorId === id)
      return {
        ...info,
        rating: theirReviews.length ? theirReviews.reduce((sum, r) => sum + r.rating, 0) / theirReviews.length : 0,
        reviewCount: theirReviews.length,
        completedProjects: projects.filter((p) => p.awardedContractorId === id && p.status === "completed").length,
      }
    },
    [contractorInfo, reviews, projects],
  )
  const getProject = useCallback((id: string) => projects.find((p) => p.projectId === id), [projects])
  const getBidsForProject = useCallback((projectId: string) => bids.filter((b) => b.projectId === projectId), [bids])
  const getBidsByContractor = useCallback(
    (contractorId: string) => bids.filter((b) => b.contractorId === contractorId),
    [bids],
  )
  const getReviewsForContractor = useCallback(
    (contractorId: string) => reviews.filter((r) => r.contractorId === contractorId),
    [reviews],
  )
  const getMessagesForConversation = useCallback(
    (conversationId: string) =>
      messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
    [messages],
  )

  const addProject = useCallback(
    async (input: NewProjectInput) => {
      if (!authUser) throw new Error("Sign in to post a project.")
      const client = generateClient<Schema>()
      const { data, errors } = await client.models.Project.create({
        clientId: authUser.userId,
        clientName: `${authUser.firstName} ${authUser.lastName}`.trim(),
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        location: input.location,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        status: "open",
        images: input.images.length ? input.images : ["/images/projects/painting.png"],
      })
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't post the project.")
      const project = toProject(data)
      setProjects((prev) => [project, ...prev])
      toast.success("Project posted", { description: `“${input.title}” is now live for contractors to bid on.` })
      return project
    },
    [authUser],
  )

  /** Saves the owner's edits to an open project. Throws with a readable message on failure. */
  const updateProjectDetails = useCallback(
    async (projectId: string, input: ProjectDetailsInput) => {
      const project = projects.find((p) => p.projectId === projectId)
      if (!authUser || project?.clientId !== authUser.userId) throw new Error("Only the client who posted this project can edit it.")
      if (project.status !== "open") throw new Error("This project can't be edited after a bid is accepted.")
      const client = generateClient<Schema>()
      const { data, errors } = await client.models.Project.update({
        id: projectId,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        location: input.location,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        ...(input.images && { images: input.images }),
      })
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't save your changes.")
      const updated = toProject(data)
      setProjects((prev) => prev.map((p) => (p.projectId === projectId ? updated : p)))
      toast.success("Project updated")
      return updated
    },
    [authUser, projects],
  )

  /** Places a bid through the placeBid backend function. Throws with a readable message on failure. */
  const addBid = useCallback(async (projectId: string, input: NewBidInput) => {
    const client = generateClient<Schema>()
    const { data, errors } = await client.mutations.placeBid({ projectId, ...input })
    if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't submit your bid.")
    setBids((prev) => [toBid(data), ...prev])
    toast.success("Bid submitted", { description: "The client can now review your proposal." })
  }, [])

  const updateBid = useCallback(async (bidId: string, input: BidChangesInput) => {
    const client = generateClient<Schema>()
    const { data, errors } = await client.mutations.reviseBid({ bidId, ...input })
    if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't update your bid.")
    const updated = toBid(data)
    setBids((prev) => prev.map((b) => (b.bidId === bidId ? updated : b)))
    toast.success("Bid updated", { description: "The client will see your new amount." })
  }, [])

  /** Accepts or declines a bid through the respondToBid backend function, then reloads. */
  const respondToBid = useCallback(
    async (bidId: string, accept: boolean) => {
      const client = generateClient<Schema>()
      // Send the amount on screen so the server refuses if the contractor changed it meanwhile.
      const expectedAmount = accept ? bids.find((b) => b.bidId === bidId)?.amount : undefined
      const { data, errors } = await client.mutations.respondToBid({ bidId, accept, expectedAmount })
      if (errors?.length || !data) {
        toast.error(accept ? "Couldn't accept the bid" : "Couldn't decline the bid", {
          description: errors?.[0]?.message ?? "Please try again.",
        })
        loadBids() // show the latest amounts
        return
      }
      // Accepting also changes the project and the other bids, so reload both.
      await Promise.all([loadBids(), loadProjects()])
      if (accept) {
        const contractor = getContractor(data.contractorId)
        toast.success("Bid accepted", {
          description: `${contractor?.businessName ?? "The contractor"} has been hired. The project is now in progress.`,
        })
      } else {
        toast("Bid declined")
      }
    },
    [bids, loadBids, loadProjects, getContractor],
  )
  const acceptBid = useCallback((bidId: string) => respondToBid(bidId, true), [respondToBid])
  const rejectBid = useCallback((bidId: string) => respondToBid(bidId, false), [respondToBid])

  const completeProject = useCallback(
    (projectId: string) => {
      updateProjectInDb(projectId, { status: "completed", completionDate: new Date().toISOString() })
        .then(() =>
          toast.success("Project marked complete", { description: "You can now leave a review for the contractor." }),
        )
        .catch((err) => toast.error("Couldn't complete the project", { description: err.message }))
    },
    [updateProjectInDb],
  )

  const addReview = useCallback(
    (projectId: string, rating: number, reviewText: string) => {
      const project = projects.find((p) => p.projectId === projectId)
      if (!project || !project.awardedContractorId) return
      const review: Review = {
        reviewId: uid("r"),
        projectId,
        projectTitle: project.title,
        clientId: CURRENT_CLIENT_ID,
        clientName: `${CLIENT_USER.firstName} ${CLIENT_USER.lastName}`,
        contractorId: project.awardedContractorId,
        rating,
        reviewText,
        createdAt: new Date().toISOString(),
      }
      setReviews((prev) => [review, ...prev])
      toast.success("Review submitted", { description: "Thanks for sharing your feedback!" })
    },
    [projects],
  )

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const conv = conversationRows.find((c) => c.conversationId === conversationId)
      if (!authUser || !conv) throw new Error("Couldn't find this conversation.")
      const isClient = authUser.userId === conv.clientId
      const client = generateClient<Schema>()
      const { data, errors } = await client.models.Message.create({
        conversationId,
        senderId: authUser.userId,
        senderName: `${authUser.firstName} ${authUser.lastName}`.trim(),
        receiverId: isClient ? conv.contractorId : conv.clientId,
        messageBody: body,
        sentAt: new Date().toISOString(),
      })
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't send your message.")
      addMessage(toMessage(data))
    },
    [authUser, conversationRows, addMessage],
  )

  const startConversation = useCallback(async (projectId: string, contractorId: string) => {
    const client = generateClient<Schema>()
    const { data, errors } = await client.mutations.startConversation({ projectId, contractorId })
    if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "Couldn't open the conversation.")
    const conv = toConversation(data)
    setConversationRows((prev) =>
      prev.some((c) => c.conversationId === conv.conversationId) ? prev : [conv, ...prev],
    )
    return conv.conversationId
  }, [])

  const markNotificationsRead = useCallback(() => {
    if (role === "client") setClientNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    else setContractorNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [role])

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      authUser,
      authLoading,
      refreshAuthUser,
      role,
      setRole,
      currentUser,
      currentClientId: authUser?.userId ?? CURRENT_CLIENT_ID,
      currentContractorId: authUser?.userType === "contractor" ? authUser.userId : CURRENT_CONTRACTOR_ID,
      projects,
      projectsLoading,
      bids,
      contractors: seedContractors,
      reviews,
      conversations,
      messages,
      notifications,
      unreadCount,
      addProject,
      updateProjectDetails,
      addBid,
      updateBid,
      acceptBid,
      rejectBid,
      completeProject,
      addReview,
      sendMessage,
      startConversation,
      markNotificationsRead,
      getContractor,
      getProject,
      getBidsForProject,
      getBidsByContractor,
      getReviewsForContractor,
      getMessagesForConversation,
    }),
    [
      authUser,
      authLoading,
      refreshAuthUser,
      role,
      currentUser,
      projects,
      projectsLoading,
      bids,
      reviews,
      conversations,
      messages,
      notifications,
      unreadCount,
      addProject,
      updateProjectDetails,
      addBid,
      updateBid,
      acceptBid,
      rejectBid,
      completeProject,
      addReview,
      sendMessage,
      startConversation,
      markNotificationsRead,
      getContractor,
      getProject,
      getBidsForProject,
      getBidsByContractor,
      getReviewsForContractor,
      getMessagesForConversation,
    ],
  )

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext)
  if (!ctx) throw new Error("useMarketplace must be used within MarketplaceProvider")
  return ctx
}
