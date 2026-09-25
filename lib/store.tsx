"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  bids as seedBids,
  clientNotifications as seedClientNotifs,
  contractorNotifications as seedContractorNotifs,
  contractors as seedContractors,
  conversations as seedConversations,
  CURRENT_CLIENT_ID,
  CURRENT_CONTRACTOR_ID,
  CLIENT_USER,
  CONTRACTOR_USER,
  messages as seedMessages,
  projects as seedProjects,
  reviews as seedReviews,
} from "./mock-data"
import type {
  AppNotification,
  Bid,
  Contractor,
  Conversation,
  Message,
  Project,
  ProjectStatus,
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

interface NewBidInput {
  amount: number
  estimatedDays: number
  proposalMessage: string
}

interface MarketplaceContextValue {
  role: UserType
  setRole: (role: UserType) => void
  currentUser: User
  currentClientId: string
  currentContractorId: string
  projects: Project[]
  bids: Bid[]
  contractors: Contractor[]
  reviews: Review[]
  conversations: Conversation[]
  messages: Message[]
  notifications: AppNotification[]
  unreadCount: number
  // actions
  addProject: (input: NewProjectInput) => Project
  addBid: (projectId: string, input: NewBidInput) => void
  acceptBid: (bidId: string) => void
  rejectBid: (bidId: string) => void
  completeProject: (projectId: string) => void
  addReview: (projectId: string, rating: number, reviewText: string) => void
  sendMessage: (conversationId: string, body: string) => void
  startConversation: (projectId: string, contractorId: string) => string
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

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserType>("client")
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const [bids, setBids] = useState<Bid[]>(seedBids)
  const [reviews, setReviews] = useState<Review[]>(seedReviews)
  const [conversations, setConversations] = useState<Conversation[]>(seedConversations)
  const [messages, setMessages] = useState<Message[]>(seedMessages)
  const [clientNotifs, setClientNotifs] = useState<AppNotification[]>(seedClientNotifs)
  const [contractorNotifs, setContractorNotifs] = useState<AppNotification[]>(seedContractorNotifs)

  const currentUser = role === "client" ? CLIENT_USER : CONTRACTOR_USER
  const notifications = role === "client" ? clientNotifs : contractorNotifs
  const unreadCount = notifications.filter((n) => !n.read).length

  const getContractor = useCallback((id: string) => seedContractors.find((c) => c.contractorId === id), [])
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

  const addProject = useCallback((input: NewProjectInput) => {
    const project: Project = {
      projectId: uid("p"),
      clientId: CURRENT_CLIENT_ID,
      clientName: `${CLIENT_USER.firstName} ${CLIENT_USER.lastName}`,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      location: input.location,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      status: "open",
      createdAt: new Date().toISOString(),
      images: input.images.length ? input.images : ["/images/projects/painting.png"],
    }
    setProjects((prev) => [project, ...prev])
    toast.success("Project posted", { description: `“${input.title}” is now live for contractors to bid on.` })
    return project
  }, [])

  const addBid = useCallback(
    (projectId: string, input: NewBidInput) => {
      const existing = bids.find((b) => b.projectId === projectId && b.contractorId === CURRENT_CONTRACTOR_ID)
      if (existing) {
        toast.error("You already placed a bid on this project.")
        return
      }
      const bid: Bid = {
        bidId: uid("b"),
        projectId,
        contractorId: CURRENT_CONTRACTOR_ID,
        amount: input.amount,
        estimatedDays: input.estimatedDays,
        proposalMessage: input.proposalMessage,
        bidDate: new Date().toISOString(),
        status: "pending",
      }
      setBids((prev) => [bid, ...prev])
      toast.success("Bid submitted", { description: "The client has been notified of your proposal." })
    },
    [bids],
  )

  const acceptBid = useCallback(
    (bidId: string) => {
      const bid = bids.find((b) => b.bidId === bidId)
      if (!bid) return
      setBids((prev) =>
        prev.map((b) => {
          if (b.projectId !== bid.projectId) return b
          if (b.bidId === bidId) return { ...b, status: "accepted" as const }
          return { ...b, status: "rejected" as const }
        }),
      )
      setProjects((prev) =>
        prev.map((p) =>
          p.projectId === bid.projectId
            ? {
                ...p,
                status: "in_progress" as ProjectStatus,
                awardedContractorId: bid.contractorId,
                startDate: new Date().toISOString(),
              }
            : p,
        ),
      )
      const contractor = getContractor(bid.contractorId)
      toast.success("Bid accepted", {
        description: `${contractor?.businessName ?? "The contractor"} has been hired. The project is now in progress.`,
      })
    },
    [bids, getContractor],
  )

  const rejectBid = useCallback((bidId: string) => {
    setBids((prev) => prev.map((b) => (b.bidId === bidId ? { ...b, status: "rejected" as const } : b)))
    toast("Bid declined")
  }, [])

  const completeProject = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.projectId === projectId
          ? { ...p, status: "completed" as ProjectStatus, completionDate: new Date().toISOString() }
          : p,
      ),
    )
    toast.success("Project marked complete", { description: "You can now leave a review for the contractor." })
  }, [])

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
    (conversationId: string, body: string) => {
      const conv = conversations.find((c) => c.conversationId === conversationId)
      if (!conv) return
      const isClient = role === "client"
      const message: Message = {
        messageId: uid("m"),
        conversationId,
        senderId: isClient ? conv.clientId : conv.contractorId,
        senderName: isClient ? conv.clientName : conv.contractorName,
        receiverId: isClient ? conv.contractorId : conv.clientId,
        messageBody: body,
        sentAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, message])
    },
    [conversations, role],
  )

  const startConversation = useCallback(
    (projectId: string, contractorId: string) => {
      const existing = conversations.find((c) => c.projectId === projectId && c.contractorId === contractorId)
      if (existing) return existing.conversationId
      const project = projects.find((p) => p.projectId === projectId)
      const contractor = getContractor(contractorId)
      if (!project || !contractor) return ""
      const conv: Conversation = {
        conversationId: uid("conv"),
        projectId,
        projectTitle: project.title,
        projectStatus: project.status,
        clientId: project.clientId,
        clientName: project.clientName,
        contractorId,
        contractorName: contractor.contractorName,
        contractorAvatar: contractor.avatar,
      }
      setConversations((prev) => [conv, ...prev])
      return conv.conversationId
    },
    [conversations, projects, getContractor],
  )

  const markNotificationsRead = useCallback(() => {
    if (role === "client") setClientNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    else setContractorNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [role])

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      role,
      setRole,
      currentUser,
      currentClientId: CURRENT_CLIENT_ID,
      currentContractorId: CURRENT_CONTRACTOR_ID,
      projects,
      bids,
      contractors: seedContractors,
      reviews,
      conversations,
      messages,
      notifications,
      unreadCount,
      addProject,
      addBid,
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
      role,
      currentUser,
      projects,
      bids,
      reviews,
      conversations,
      messages,
      notifications,
      unreadCount,
      addProject,
      addBid,
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
