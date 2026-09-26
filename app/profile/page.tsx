"use client"

import { useState } from "react"

import {
  ProfileForm,
  type ContractorProfileData,
  type ProfileData,
} from "@/components/profile/profile-form"

// Placeholder sample data. Replace with data from your own backend.
const SAMPLE_EMAIL = "miguel@torresconstruction.com"

const SAMPLE_PROFILE: ProfileData = {
  firstName: "Miguel",
  lastName: "Torres",
  avatar: null,
}

const SAMPLE_CONTRACTOR: ContractorProfileData = {
  businessName: "Torres Construction",
  contractorName: "Miguel Torres",
  licenseNumber: "TX-489201",
  yearsExperience: 12,
  location: "Austin, TX",
  specialty: "Remodeling",
  about:
    "Family-owned general contracting business specializing in full-home remodels and kitchen renovations. Licensed, insured, and proud of our detail-first craftsmanship.",
  skills: ["Framing", "Tile work", "Cabinetry", "Drywall"],
  services: ["Kitchen remodels", "Bathroom renovations", "Home additions"],
}

export default function ProfilePage() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  function handleSave(data: {
    profile: ProfileData
    contractorProfile?: ContractorProfileData
  }) {
    // Wire this up to your own backend.
    setError(undefined)
    setSaving(true)
    console.log("[v0] Saving profile:", data)
    window.setTimeout(() => setSaving(false), 800)
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account details and how clients see you.</p>
      </header>

      <ProfileForm
        userType="contractor"
        email={SAMPLE_EMAIL}
        profile={SAMPLE_PROFILE}
        contractorProfile={SAMPLE_CONTRACTOR}
        saving={saving}
        error={error}
        onSave={handleSave}
        onAvatarChange={(file) => console.log("[v0] Avatar selected:", file.name)}
      />
    </main>
  )
}
