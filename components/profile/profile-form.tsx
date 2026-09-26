"use client"

import type React from "react"
import { useRef, useState } from "react"
import { Camera, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type UserType = "client" | "contractor"

const SPECIALTIES = [
  "Remodeling",
  "Electrical",
  "Plumbing",
  "Painting",
  "Landscaping",
  "Roofing",
  "Flooring",
  "General Contracting",
] as const

export interface ProfileData {
  firstName: string
  lastName: string
  avatar?: string | null
}

export interface ContractorProfileData {
  businessName: string
  contractorName: string
  licenseNumber?: string | null
  yearsExperience?: number | null
  location?: string | null
  specialty?: string | null
  about?: string | null
  skills: string[]
  services: string[]
}

export interface ProfileFormProps {
  userType: UserType
  email: string
  profile: ProfileData
  contractorProfile?: ContractorProfileData
  saving: boolean
  error?: string
  onSave: (data: { profile: ProfileData; contractorProfile?: ContractorProfileData }) => void
  onAvatarChange?: (file: File) => void
}

type Errors = Record<string, string>

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

export function ProfileForm({
  userType,
  email,
  profile,
  contractorProfile,
  saving,
  error,
  onSave,
  onAvatarChange,
}: ProfileFormProps) {
  const isContractor = userType === "contractor"
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Personal info
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar ?? null)

  // Contractor info
  const [businessName, setBusinessName] = useState(contractorProfile?.businessName ?? "")
  const [contractorName, setContractorName] = useState(contractorProfile?.contractorName ?? "")
  const [licenseNumber, setLicenseNumber] = useState(contractorProfile?.licenseNumber ?? "")
  const [yearsExperience, setYearsExperience] = useState<string>(
    contractorProfile?.yearsExperience != null ? String(contractorProfile.yearsExperience) : "",
  )
  const [location, setLocation] = useState(contractorProfile?.location ?? "")
  const [specialty, setSpecialty] = useState(contractorProfile?.specialty ?? "")
  const [about, setAbout] = useState(contractorProfile?.about ?? "")
  const [skills, setSkills] = useState<string[]>(contractorProfile?.skills ?? [])
  const [services, setServices] = useState<string[]>(contractorProfile?.services ?? [])
  const [skillDraft, setSkillDraft] = useState("")
  const [serviceDraft, setServiceDraft] = useState("")

  const [errors, setErrors] = useState<Errors>({})

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    onAvatarChange?.(file)
  }

  function addChip(
    draft: string,
    list: string[],
    setList: (v: string[]) => void,
    setDraft: (v: string) => void,
  ) {
    const value = draft.trim()
    if (!value) return
    if (!list.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setList([...list, value])
    }
    setDraft("")
  }

  function chipKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    draft: string,
    list: string[],
    setList: (v: string[]) => void,
    setDraft: (v: string) => void,
  ) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addChip(draft, list, setList, setDraft)
    } else if (e.key === "Backspace" && draft === "" && list.length > 0) {
      setList(list.slice(0, -1))
    }
  }

  function validate(): boolean {
    const next: Errors = {}
    if (!firstName.trim()) next.firstName = "First name is required."
    if (!lastName.trim()) next.lastName = "Last name is required."

    if (isContractor) {
      if (!businessName.trim()) next.businessName = "Business name is required."
      if (!contractorName.trim()) next.contractorName = "Contractor name is required."
      if (yearsExperience.trim() !== "") {
        const years = Number(yearsExperience)
        if (!Number.isFinite(years) || years < 0 || years > 80) {
          next.yearsExperience = "Enter a value between 0 and 80."
        }
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    const nextProfile: ProfileData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      avatar: avatarPreview,
    }

    const nextContractor: ContractorProfileData | undefined = isContractor
      ? {
          businessName: businessName.trim(),
          contractorName: contractorName.trim(),
          licenseNumber: licenseNumber.trim() || null,
          yearsExperience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
          location: location.trim() || null,
          specialty: specialty || null,
          about: about.trim() || null,
          skills,
          services,
        }
      : undefined

    onSave({ profile: nextProfile, contractorProfile: nextContractor })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-24">
      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:flex-row sm:text-left">
          <div className="relative">
            <Avatar className="size-20">
              {avatarPreview ? (
                <AvatarImage src={avatarPreview || "/placeholder.svg"} alt={`${firstName} ${lastName}`} />
              ) : null}
              <AvatarFallback className="text-lg">{initials(firstName, lastName)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Your name"}
              </h2>
              <Badge variant={isContractor ? "default" : "secondary"}>
                {isContractor ? "Contractor" : "Client"}
              </Badge>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handlePickFile}>
              <Camera data-icon="inline-start" />
              Change photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileSelected}
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your name and see the email tied to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.firstName ? true : undefined}>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-invalid={errors.firstName ? true : undefined}
                  placeholder="Jane"
                />
                {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
              </Field>
              <Field data-invalid={errors.lastName ? true : undefined}>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-invalid={errors.lastName ? true : undefined}
                  placeholder="Doe"
                />
                {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" value={email} disabled readOnly />
              <FieldDescription>Email can&apos;t be changed.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Business info (contractors only) */}
      {isContractor ? (
        <Card>
          <CardHeader>
            <CardTitle>Business information</CardTitle>
            <CardDescription>Details clients see when they view your profile and bids.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.businessName ? true : undefined}>
                  <FieldLabel htmlFor="businessName">Business name</FieldLabel>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    aria-invalid={errors.businessName ? true : undefined}
                    placeholder="Torres Construction"
                  />
                  {errors.businessName ? <FieldError>{errors.businessName}</FieldError> : null}
                </Field>
                <Field data-invalid={errors.contractorName ? true : undefined}>
                  <FieldLabel htmlFor="contractorName">Contractor name</FieldLabel>
                  <Input
                    id="contractorName"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    aria-invalid={errors.contractorName ? true : undefined}
                    placeholder="Miguel Torres"
                  />
                  {errors.contractorName ? <FieldError>{errors.contractorName}</FieldError> : null}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="licenseNumber">License number</FieldLabel>
                  <Input
                    id="licenseNumber"
                    value={licenseNumber ?? ""}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="CA-123456"
                  />
                </Field>
                <Field data-invalid={errors.yearsExperience ? true : undefined}>
                  <FieldLabel htmlFor="yearsExperience">Years of experience</FieldLabel>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min={0}
                    max={80}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    aria-invalid={errors.yearsExperience ? true : undefined}
                    placeholder="12"
                  />
                  {errors.yearsExperience ? <FieldError>{errors.yearsExperience}</FieldError> : null}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    value={location ?? ""}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Austin, TX"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="specialty">Specialty</FieldLabel>
                  <Select value={specialty} onValueChange={(v) => setSpecialty(v ?? "")}>
                    <SelectTrigger id="specialty">
                      <SelectValue placeholder="Select a specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SPECIALTIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="about">About</FieldLabel>
                <Textarea
                  id="about"
                  rows={4}
                  value={about ?? ""}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Tell clients about your business, experience, and what sets your work apart."
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {/* Skills & Services (contractors only) */}
      {isContractor ? (
        <Card>
          <CardHeader>
            <CardTitle>Skills &amp; services</CardTitle>
            <CardDescription>Type and press Enter to add. Click the × on a tag to remove it.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="skills">Skills</FieldLabel>
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                        {skill}
                        <button
                          type="button"
                          onClick={() => setSkills(skills.filter((s) => s !== skill))}
                          className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${skill}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Input
                  id="skills"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => chipKeyDown(e, skillDraft, skills, setSkills, setSkillDraft)}
                  onBlur={() => addChip(skillDraft, skills, setSkills, setSkillDraft)}
                  placeholder="e.g. Framing, Tile, Drywall"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="services">Services</FieldLabel>
                {services.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => (
                      <Badge key={service} variant="secondary" className="gap-1 pr-1">
                        {service}
                        <button
                          type="button"
                          onClick={() => setServices(services.filter((s) => s !== service))}
                          className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${service}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Input
                  id="services"
                  value={serviceDraft}
                  onChange={(e) => setServiceDraft(e.target.value)}
                  onKeyDown={(e) => chipKeyDown(e, serviceDraft, services, setServices, setServiceDraft)}
                  onBlur={() => addChip(serviceDraft, services, setServices, setServiceDraft)}
                  placeholder="e.g. Kitchen remodels, Bathroom renovations"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
