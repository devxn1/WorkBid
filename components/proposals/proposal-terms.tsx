import { Check, X } from "lucide-react"
import { formatCurrency, formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ProposalTerms } from "@/lib/types"

function Term({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** Read-only view of a proposal's (or agreement's) terms. */
export function ProposalTermsView({ terms }: { terms: ProposalTerms }) {
  const hasCosts = terms.materialsCost != null || terms.laborCost != null
  return (
    <dl className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Term label="Total price">
          <span className="font-heading text-xl font-bold">{formatCurrency(terms.amount)}</span>
        </Term>
        <Term label="Proposed start">{terms.startDate ? formatDay(terms.startDate) : <Missing />}</Term>
        <Term label="Duration">{terms.estimatedDays} days</Term>
      </div>

      <Term label="Scope of work">
        <p className="whitespace-pre-line leading-relaxed text-pretty">{terms.scope}</p>
      </Term>

      {(hasCosts || terms.materialsDetail) && (
        <div className="grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3">
          {terms.materialsCost != null && <Term label="Materials">{formatCurrency(terms.materialsCost)}</Term>}
          {terms.laborCost != null && <Term label="Labor">{formatCurrency(terms.laborCost)}</Term>}
          {terms.materialsDetail && (
            <Term label="Materials used" className={hasCosts ? "" : "sm:col-span-3"}>
              {terms.materialsDetail}
            </Term>
          )}
        </div>
      )}

      {(terms.included.length > 0 || terms.excluded.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {terms.included.length > 0 && (
            <Term label="Included">
              <ul className="flex flex-col gap-1">
                {terms.included.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check width={15} height={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Term>
          )}
          {terms.excluded.length > 0 && (
            <Term label="Not included">
              <ul className="flex flex-col gap-1">
                {terms.excluded.map((item) => (
                  <li key={item} className="flex gap-2">
                    <X width={15} height={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Term>
          )}
        </div>
      )}

      <Term label="Payment terms">{terms.paymentTerms || <Missing />}</Term>
      {terms.notes && (
        <Term label="Notes and assumptions">
          <p className="whitespace-pre-line text-pretty">{terms.notes}</p>
        </Term>
      )}
    </dl>
  )
}

function Missing() {
  return <span className="text-destructive">Not provided</span>
}
