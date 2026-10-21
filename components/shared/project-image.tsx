"use client"

import { useEffect, useState } from "react"
import { getUrl } from "aws-amplify/storage"

// Signed S3 links, cached so lists don't ask for the same link over and over.
// getUrl's links expire after 15 minutes; refresh a bit before that.
const LINK_LIFETIME_MS = 14 * 60 * 1000
const linkCache = new Map<string, { url: string; expires: number }>()

/** True for a value that's already a usable URL (stock photos under /public, or a full link). */
function isDirectUrl(src: string) {
  return src.startsWith("/") || src.startsWith("http") || src.startsWith("blob:")
}

async function resolveUrl(path: string) {
  const cached = linkCache.get(path)
  if (cached && cached.expires > Date.now()) return cached.url
  const { url } = await getUrl({ path })
  const href = url.toString()
  linkCache.set(path, { url: href, expires: Date.now() + LINK_LIFETIME_MS })
  return href
}

interface ProjectImageProps {
  /** A stock photo path like "/images/projects/deck.png", or an S3 path from an upload. */
  src: string | undefined
  alt: string
  className?: string
}

/** Shows a project photo, turning uploaded S3 paths into viewable links. */
export function ProjectImage({ src, alt, className }: ProjectImageProps) {
  const [resolved, setResolved] = useState<{ src: string; url: string } | null>(null)
  const direct = !src || isDirectUrl(src)

  useEffect(() => {
    if (!src || isDirectUrl(src)) return
    let cancelled = false
    resolveUrl(src)
      .then((url) => !cancelled && setResolved({ src, url }))
      .catch((err) => console.error("Couldn't load photo", src, err))
    return () => {
      cancelled = true
    }
  }, [src])

  const url = direct ? src || "/placeholder.svg" : resolved?.src === src ? resolved.url : undefined
  if (!url) return <div className={className} aria-label={alt} role="img" />
  return <img src={url} alt={alt} className={className} />
}
