import Link from "next/link"
import Image from "next/image"
import { Hammer, ShieldCheck, Star, Users } from "lucide-react"

interface AuthShellProps {
  children: React.ReactNode
}

const highlights = [
  { icon: Users, label: "12,000+ vetted contractors" },
  { icon: ShieldCheck, label: "Licensed & insured professionals" },
  { icon: Star, label: "Real reviews from real projects" },
]

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hammer className="size-4" />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">WorkBid</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand column */}
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <Image
          src="/images/hero.png"
          alt=""
          fill
          className="object-cover opacity-25"
          priority
        />
        <div className="relative flex h-full flex-col justify-between p-16">
          <div />
          <div className="flex flex-col gap-6">
            <h2 className="font-heading text-3xl font-bold leading-tight text-primary-foreground text-balance">
              The smarter way to hire for your next project.
            </h2>
            <p className="max-w-md leading-relaxed text-primary-foreground/80">
              Post a job, compare competitive bids from local pros, and hire with confidence — all in one place.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {highlights.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-primary-foreground">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
                    <item.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
