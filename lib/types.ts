export type UserType = "client" | "contractor"

export type ProjectStatus = "open" | "awarded" | "in_progress" | "completed"

export type BidStatus = "pending" | "accepted" | "rejected"

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
  audience: UserType
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
}
