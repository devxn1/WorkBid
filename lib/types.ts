export type UserType = "client" | "contractor"

/** "awarded" is shown as "Hired". */
export type ProjectStatus = "open" | "awarded" | "in_progress" | "completed"

/** "pending" is shown as "Submitted"; "closed" means another contractor was hired. */
export type BidStatus = "pending" | "revision_requested" | "accepted" | "rejected" | "withdrawn" | "closed"

export interface User {
  userId: string
  firstName: string
  lastName: string
  email: string
  userType: UserType
  avatar: string
}

export interface Category {
  categoryId: string
  name: string
  icon: string
}

export interface Project {
  projectId: string
  clientId: string
  clientName: string
  categoryId: string
  title: string
  description: string
  location: string
  budgetMin: number
  budgetMax: number
  /** Free text such as "Within 2 weeks". */
  timeline?: string
  status: ProjectStatus
  createdAt: string
  startDate?: string
  completionDate?: string
  images: string[]
  awardedContractorId?: string
}

export interface Bid {
  bidId: string
  projectId: string
  contractorId: string
  amount: number
  estimatedDays: number
  proposalMessage: string
  bidDate: string
  status: BidStatus
  /** When the contractor last revised the bid, if ever. */
  amountUpdatedAt?: string
  currentVersionId?: string
  /** The current proposal version number (1 = original). */
  currentVersion: number
  /** The amount before the latest revision. */
  previousAmount?: number
  /** The client's note when they asked for a revision. */
  revisionNote?: string
}

/** The terms of an offer, shared by proposal versions and agreements. */
export interface ProposalTerms {
  amount: number
  scope: string
  estimatedDays: number
  /** YYYY-MM-DD */
  startDate?: string
  paymentTerms?: string
  materialsCost?: number
  laborCost?: number
  materialsDetail?: string
  included: string[]
  excluded: string[]
  notes?: string
}

export type BidVersionStatus = "active" | "superseded" | "accepted"

/** One version of a contractor's proposal. Versions are never edited. */
export interface BidVersion extends ProposalTerms {
  versionId: string
  bidId: string
  version: number
  status: BidVersionStatus
  changeSummary?: string
  createdAt: string
}

/** The confirmed terms between a client and the hired contractor. Never changes. */
export interface Agreement extends ProposalTerms {
  agreementId: string
  projectId: string
  projectTitle: string
  bidId: string
  bidVersionId: string
  version: number
  clientId: string
  clientName: string
  contractorId: string
  contractorName: string
  businessName?: string
  confirmedAt: string
}

export type ChangeOrderStatus = "proposed" | "approved" | "declined"

export interface ChangeOrder {
  changeOrderId: string
  agreementId: string
  proposedBy: string
  description: string
  amountChange: number
  daysChange: number
  status: ChangeOrderStatus
  createdAt: string
  respondedAt?: string
}

export interface Contractor {
  contractorId: string
  userId: string
  businessName: string
  contractorName: string
  licenseNumber: string
  yearsExperience: number
  rating: number
  reviewCount: number
  location: string
  specialty: string
  verified: boolean
  avatar: string
  about: string
  skills: string[]
  services: string[]
  completedProjects: number
}

export interface Review {
  reviewId: string
  projectId: string
  projectTitle: string
  clientId: string
  clientName: string
  contractorId: string
  rating: number
  reviewText: string
  createdAt: string
}

export interface Message {
  messageId: string
  conversationId: string
  senderId: string
  senderName: string
  receiverId: string
  messageBody: string
  sentAt: string
}

export interface Conversation {
  conversationId: string
  projectId: string
  projectTitle: string
  projectStatus: ProjectStatus
  clientId: string
  clientName: string
  contractorId: string
  contractorName: string
  contractorAvatar: string
}

export interface AppNotification {
  notificationId: string
  /** Only used by the sample notifications in mock-data. */
  audience?: UserType
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
}
