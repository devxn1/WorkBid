"use client"

import { useCallback, useEffect, useState } from "react"
import { generateClient } from "aws-amplify/data"
import { remove } from "aws-amplify/storage"
import type { Schema } from "@/amplify/data/resource"
import { orThrow } from "./proposals"
import type { PortfolioItem } from "./types"

type PortfolioRow = Schema["PortfolioItem"]["type"]

/** What a contractor fills in for a portfolio item. */
export interface PortfolioInput {
  title: string
  description: string | null
  location: string | null
  completedOn: string | null
  images: string[]
}

function toPortfolioItem(row: PortfolioRow): PortfolioItem {
  return {
    itemId: row.id,
    contractorId: row.contractorId,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    completedOn: row.completedOn ?? undefined,
    images: (row.images ?? []).filter((x): x is string => !!x),
    createdAt: row.createdAt,
  }
}

/** Newest work first: by completion date, then by when it was added. */
function byNewest(a: PortfolioItem, b: PortfolioItem) {
  return (b.completedOn ?? b.createdAt).localeCompare(a.completedOn ?? a.createdAt)
}

/** A contractor's portfolio. Pass `signedIn` so signed-out visitors read as guests. */
export function usePortfolio(contractorId: string | undefined, signedIn: boolean) {
  const [state, setState] = useState<{ key?: string; items?: PortfolioItem[]; error?: string }>({})
  const [version, setVersion] = useState(0)
  const key = contractorId ? `${contractorId}:${signedIn}` : undefined

  useEffect(() => {
    if (!contractorId || !key) return
    let cancelled = false
    const client = generateClient<Schema>()
    client.models.PortfolioItem.listPortfolioItemByContractorId(
      { contractorId },
      { authMode: signedIn ? "userPool" : "identityPool", limit: 1000 },
    )
      .then(({ data, errors }) => {
        if (errors?.length) throw new Error(errors[0].message)
        if (!cancelled) setState({ key, items: data.map(toPortfolioItem).sort(byNewest) })
      })
      .catch((err) => !cancelled && setState({ key, error: err instanceof Error ? err.message : String(err) }))
    return () => {
      cancelled = true
    }
  }, [contractorId, signedIn, key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = state.key === key
  return {
    items: current ? (state.items ?? []) : [],
    error: current ? state.error : undefined,
    loading: !!key && !current,
    reload,
  }
}

/** Deletes photos from S3. Never throws: a leftover photo isn't worth failing the save. */
async function removePhotos(paths: string[]) {
  await Promise.all(
    paths.map((path) => remove({ path }).catch((err) => console.error("Couldn't delete photo", path, err))),
  )
}

/** Adds a portfolio item, or updates `existing`. Photos dropped from it are deleted. */
export async function savePortfolioItem(contractorId: string, input: PortfolioInput, existing?: PortfolioItem) {
  const client = generateClient<Schema>()
  const row = existing
    ? orThrow(await client.models.PortfolioItem.update({ id: existing.itemId, ...input }), "Couldn't save this work.")
    : orThrow(await client.models.PortfolioItem.create({ contractorId, ...input }), "Couldn't save this work.")
  if (existing) await removePhotos(existing.images.filter((path) => !input.images.includes(path)))
  return toPortfolioItem(row)
}

export async function deletePortfolioItem(item: PortfolioItem) {
  const client = generateClient<Schema>()
  orThrow(await client.models.PortfolioItem.delete({ id: item.itemId }), "Couldn't delete this work.")
  await removePhotos(item.images)
}
