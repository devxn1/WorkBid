"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { generateClient } from "aws-amplify/data"
import { toast } from "sonner"

import type { Schema } from "@/amplify/data/resource"
import { useMarketplace } from "@/lib/store"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ProfileForm,
  type ContractorProfileData,
  type ProfileData,
} from "@/components/profile/profile-form"

type ContractorRow = Schema["ContractorProfile"]["type"]

/** Converts a database row into the shape the form expects (no nulls inside the arrays). */
function toFormData(row: ContractorRow): ContractorProfileData {
  return {
    businessName: row.businessName,
    contractorName: row.contractorName,
    licenseNumber: row.licenseNumber,
    yearsExperience: row.yearsExperience,
    location: row.location,
    specialty: row.specialty,
    about: row.about,
    skills: (row.skills ?? []).filter((s): s is string => !!s),
    services: (row.services ?? []).filter((s): s is string => !!s),
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { authUser, authLoading, refreshAuthUser } = useMarketplace()

  // undefined = still loading, null = contractor hasn't filled in business info yet
  const [contractorProfile, setContractorProfile] = useState<ContractorProfileData | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const isContractor = authUser?.userType === "contractor"

  // Signed out: send them to the login page.
  useEffect(() => {
    if (!authLoading && !authUser) router.replace("/login")
  }, [authLoading, authUser, router])

  // Contractors also have a ContractorProfile row; load it once we know who they are.
  useEffect(() => {
    if (!authUser) return
    if (!isContractor) {
      setContractorProfile(null)
      return
    }
    const client = generateClient<Schema>()
    client.models.ContractorProfile.get({ contractorId: authUser.userId })
      .then(({ data }) => setContractorProfile(data ? toFormData(data) : null))
      .catch(() => {
        setContractorProfile(null)
        setError("Couldn't load your business info. Refresh to try again.")
      })
  }, [authUser, isContractor])

  async function handleSave(data: { profile: ProfileData; contractorProfile?: ContractorProfileData }) {
    if (!authUser) return
    setError(undefined)
    setSaving(true)
    const client = generateClient<Schema>()
    try {
      // Avatar isn't saved yet: photos need file storage (S3), which comes later.
      const profileResult = await client.models.UserProfile.update({
        userId: authUser.userId,
        firstName: data.profile.firstName,
        lastName: data.profile.lastName,
      })
      if (profileResult.errors?.length) throw new Error(profileResult.errors[0].message)

      if (isContractor && data.contractorProfile) {
        const cp = data.contractorProfile
        const fields = {
          contractorId: authUser.userId,
          businessName: cp.businessName,
          contractorName: cp.contractorName,
          licenseNumber: cp.licenseNumber,
          yearsExperience: cp.yearsExperience == null ? null : Math.round(cp.yearsExperience),
          location: cp.location,
          specialty: cp.specialty,
          about: cp.about,
          skills: cp.skills,
          services: cp.services,
        }
        // First save creates the row; later saves update it.
        const result = contractorProfile
          ? await client.models.ContractorProfile.update(fields)
          : await client.models.ContractorProfile.create(fields)
        if (result.errors?.length) throw new Error(result.errors[0].message)
        if (result.data) setContractorProfile(toFormData(result.data))
      }

      await refreshAuthUser() // updates the name in the header
      toast.success("Profile saved")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const loaded = authUser && contractorProfile !== undefined

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">
          {isContractor
            ? "Manage your account details and how clients see you."
            : "Manage your account details."}
        </p>
      </header>

      {loaded ? (
        // The form copies its props into state once, so only render it after the data has loaded.
        <ProfileForm
          userType={authUser.userType}
          email={authUser.email}
          profile={{ firstName: authUser.firstName, lastName: authUser.lastName, avatar: authUser.avatar }}
          contractorProfile={
            isContractor
              ? (contractorProfile ?? {
                  businessName: "",
                  contractorName: `${authUser.firstName} ${authUser.lastName}`.trim(),
                  skills: [],
                  services: [],
                })
              : undefined
          }
          saving={saving}
          error={error}
          onSave={handleSave}
          onAvatarChange={() =>
            toast.info("Photo uploads are coming soon", { description: "Your new photo won't be saved yet." })
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
