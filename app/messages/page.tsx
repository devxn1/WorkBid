"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, FileText, MessagesSquare, PencilLine, SendHorizontal } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StatusBadge } from "@/components/shared/status-badge"
import { bidStatusLabels, initials, isOpenBid, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const MAX_MESSAGE_LENGTH = 2000

function MessagesInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    authUser,
    authLoading,
    role,
    conversations,
    currentClientId,
    currentContractorId,
    getMessagesForConversation,
    sendMessage,
    bids,
  } = useMarketplace()

  const myConversations = useMemo(
    () =>
      conversations.filter((c) =>
        role === "client" ? c.clientId === currentClientId : c.contractorId === currentContractorId,
      ),
    [conversations, role, currentClientId, currentContractorId],
  )

  const paramId = searchParams.get("c")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Messages are private, so signed-out visitors go to the login page.
  useEffect(() => {
    if (!authLoading && !authUser) router.replace("/login")
  }, [authLoading, authUser, router])

  useEffect(() => {
    if (paramId && myConversations.some((c) => c.conversationId === paramId)) {
      setActiveId(paramId)
    } else if (!activeId && myConversations.length > 0) {
      setActiveId(myConversations[0].conversationId)
    }
  }, [paramId, myConversations, activeId])

  const active = myConversations.find((c) => c.conversationId === activeId) ?? null
  const thread = active ? getMessagesForConversation(active.conversationId) : []
  const myId = role === "client" ? currentClientId : currentContractorId
  // The bid this conversation is about, so either side can jump to the formal proposal.
  // Chat itself never changes a bid.
  const activeBid = active
    ? bids.find((b) => b.projectId === active.projectId && b.contractorId === active.contractorId && b.status !== "withdrawn")
    : undefined
  const canRevise = role === "contractor" && !!activeBid && active?.projectStatus === "open" && isOpenBid(activeBid.status)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [thread.length, activeId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !active || sending) return
    setSending(true)
    try {
      await sendMessage(active.conversationId, body)
      setDraft("")
    } catch (err) {
      // Keep the draft so nothing typed is lost.
      toast.error("Message not sent", { description: err instanceof Error ? err.message : "Please try again." })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-foreground">Messages</h1>

      {myConversations.length === 0 ? (
        <Empty className="rounded-xl border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>No conversations yet</EmptyTitle>
            <EmptyDescription>
              {role === "client"
                ? "Message a contractor from a bid to start a conversation."
                : "Message a client from a project you've bid on to start a conversation."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid h-[600px] overflow-hidden rounded-xl border border-border md:grid-cols-[300px_1fr]">
          {/* Conversation list */}
          <div
            className={cn(
              "flex flex-col overflow-y-auto border-border md:border-r",
              active ? "hidden md:flex" : "flex",
            )}
          >
            {myConversations.map((c) => {
              const lastMsg = getMessagesForConversation(c.conversationId).slice(-1)[0]
              const isActive = c.conversationId === activeId
              return (
                <button
                  key={c.conversationId}
                  type="button"
                  onClick={() => setActiveId(c.conversationId)}
                  className={cn(
                    "flex items-start gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/60",
                    isActive && "bg-muted",
                  )}
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage
                      src={(role === "client" && c.contractorAvatar) || "/placeholder.svg"}
                      alt={role === "client" ? c.contractorName : c.clientName}
                    />
                    <AvatarFallback>
                      {initials(role === "client" ? c.contractorName : c.clientName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {role === "client" ? c.contractorName : c.clientName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.projectTitle}</p>
                    {lastMsg && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{lastMsg.messageBody}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Thread */}
          {active ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-border p-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft />
                </Button>
                <Avatar className="size-9">
                  <AvatarImage
                    src={(role === "client" && active.contractorAvatar) || "/placeholder.svg"}
                    alt={role === "client" ? active.contractorName : active.clientName}
                  />
                  <AvatarFallback>
                    {initials(role === "client" ? active.contractorName : active.clientName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {role === "client" ? active.contractorName : active.clientName}
                  </p>
                  <Link
                    href={`/projects/${active.projectId}`}
                    className="truncate text-xs text-muted-foreground hover:underline"
                  >
                    {active.projectTitle}
                  </Link>
                </div>
                <StatusBadge status={active.projectStatus} />
              </div>

              {activeBid && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Bid: <span className="font-medium text-foreground">{bidStatusLabels[activeBid.status]}</span>
                    {activeBid.currentVersion > 1 && ` · version ${activeBid.currentVersion}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7"
                    render={<Link href={`/projects/${activeBid.projectId}/bids/${activeBid.bidId}`} />}
                  >
                    <FileText data-icon="inline-start" />
                    View proposal
                  </Button>
                  {canRevise && (
                    <Button
                      size="sm"
                      className="h-7"
                      render={<Link href={`/projects/${activeBid.projectId}/proposal?revise=${activeBid.bidId}`} />}
                    >
                      <PencilLine data-icon="inline-start" />
                      Revise bid
                    </Button>
                  )}
                </div>
              )}

              <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {thread.map((m) => {
                  const mine = m.senderId === myId
                  return (
                    <div key={m.messageId} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-muted text-foreground",
                        )}
                      >
                        {m.messageBody}
                      </div>
                      <span className="px-1 text-[11px] text-muted-foreground">{relativeTime(m.sentAt)}</span>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  aria-label="Message"
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || sending} aria-label="Send message">
                  <SendHorizontal />
                </Button>
              </form>
            </div>
          ) : (
            <div className="hidden items-center justify-center text-sm text-muted-foreground md:flex">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8">Loading...</div>}>
      <MessagesInner />
    </Suspense>
  )
}
