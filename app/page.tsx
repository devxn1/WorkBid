"use client"

import Link from "next/link"
import { ArrowRight, BadgeCheck, Gavel, MessageSquare, Search, ShieldCheck, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CategoryIcon } from "@/components/shared/category-icon"
import { ContractorCard } from "@/components/shared/contractor-card"
import { ProjectCard } from "@/components/shared/project-card"
import { useMarketplace } from "@/lib/store"
import { categories } from "@/lib/mock-data"

const steps = [
  {
    icon: Search,
    title: "Post your project",
    body: "Describe the job, set a budget range, and add photos. It takes a couple of minutes.",
  },
  {
    icon: Gavel,
    title: "Compare competitive bids",
    body: "Vetted contractors send proposals with pricing and timelines. Review them side by side.",
  },
  {
    icon: MessageSquare,
    title: "Message and hire",
    body: "Ask questions, award the job to your favorite pro, and track it through completion.",
  },
]

export default function HomePage() {
  const { projects, contractors, getBidsForProject } = useMarketplace()
  const openProjects = projects.filter((p) => p.status === "open").slice(0, 3)
  const topContractors = [...contractors].sort((a, b) => b.rating - a.rating).slice(0, 3)

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit gap-1.5">
              <ShieldCheck width={14} height={14} aria-hidden="true" />
              Licensed &amp; verified contractors
            </Badge>
            <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl">
              Hire the right contractor for every project
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground text-pretty">
              Post your job once and get competitive bids from trusted local pros. Compare quotes, read reviews, and
              hire with confidence.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" render={<Link href="/post-project" />}>
                Post a project
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/projects" />}>
                Browse open work
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Star width={16} height={16} className="fill-accent text-accent" aria-hidden="true" />
                4.9 average rating
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck width={16} height={16} className="text-primary" aria-hidden="true" />
                6,000+ jobs completed
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <img
                src="/images/hero.png"
                alt="A contractor reviewing renovation plans on site"
                className="aspect-[4/3] size-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl font-bold text-foreground">Browse by category</h2>
          <p className="text-muted-foreground">Whatever the job, there&apos;s a pro for it.</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link key={cat.categoryId} href={`/projects?category=${cat.categoryId}`}>
              <Card className="transition-colors hover:border-primary/40 hover:bg-secondary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                    <CategoryIcon icon={cat.icon} size={20} />
                  </span>
                  <span className="font-medium text-foreground">{cat.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-bold text-foreground">How WorkBid works</h2>
            <p className="text-muted-foreground">From posting to hiring in three simple steps.</p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <Card key={step.title}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon width={22} height={22} aria-hidden="true" />
                    </span>
                    <span className="font-heading text-3xl font-bold text-border">{i + 1}</span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Open projects */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-bold text-foreground">Recently posted projects</h2>
            <p className="text-muted-foreground">Open jobs currently accepting bids.</p>
          </div>
          <Button variant="ghost" render={<Link href="/projects" />}>
            View all
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {openProjects.map((project) => (
            <ProjectCard key={project.projectId} project={project} bidCount={getBidsForProject(project.projectId).length} />
          ))}
        </div>
      </section>

      {/* Top contractors */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl font-bold text-foreground">Top-rated contractors</h2>
              <p className="text-muted-foreground">Highly reviewed pros ready for your project.</p>
            </div>
            <Button variant="ghost" render={<Link href="/projects" />}>
              View all
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topContractors.map((c) => (
              <ContractorCard key={c.contractorId} contractor={c} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
            <h2 className="font-heading text-2xl font-bold text-balance sm:text-3xl">
              Ready to get your project done?
            </h2>
            <p className="max-w-xl text-primary-foreground/85 text-pretty">
              Post your job for free and start receiving competitive bids from vetted contractors today.
            </p>
            <Button size="lg" variant="secondary" render={<Link href="/post-project" />}>
              Post a project
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
