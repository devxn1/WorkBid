"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { confirmSignUp, resendSignUpCode, signIn, signUp } from "aws-amplify/auth"
import { useMarketplace } from "@/lib/store"
import { authErrorMessage, ensureUserProfile } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { UserType } from "@/lib/types"

interface AuthFormProps {
  mode: "login" | "signup"
}

type Errors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "code", string>>

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const { setRole } = useMarketplace()
  const isSignup = mode === "signup"

  // "form" = email/password screen, "confirm" = enter the code Cognito emailed
  const [step, setStep] = useState<"form" | "confirm">("form")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [role, setSelectedRole] = useState<UserType>("client")
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const next: Errors = {}
    if (isSignup && !firstName.trim()) next.firstName = "Enter your first name."
    if (isSignup && !lastName.trim()) next.lastName = "Enter your last name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address."
    if (password.length < 8) {
      next.password = "Password must be at least 8 characters."
    } else if (
      isSignup &&
      !(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password))
    ) {
      next.password = "Include upper and lowercase letters, a number, and a symbol."
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Signed in: create the profile on first login, then send them to their dashboard.
  async function goToDashboard() {
    const userType = await ensureUserProfile()
    setRole(userType)
    router.push(userType === "contractor" ? "/dashboard/contractor" : "/dashboard/client")
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    setFormError("")
    setSubmitting(true)
    try {
      if (isSignup) {
        const { nextStep } = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              given_name: firstName.trim(),
              family_name: lastName.trim(),
              "custom:userType": role,
            },
          },
        })
        if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setStep("confirm")
          return
        }
      }

      const { nextStep } = await signIn({ username: email, password })
      if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
        // Signed up earlier but never entered the code: send a fresh one.
        await resendSignUpCode({ username: email })
        setStep("confirm")
        return
      }
      if (nextStep.signInStep !== "DONE") {
        setFormError("This account needs an extra sign-in step that WorkBid doesn't support yet.")
        return
      }
      await goToDashboard()
    } catch (err) {
      if (err instanceof Error && err.name === "UserAlreadyAuthenticatedException") {
        await goToDashboard()
        return
      }
      setFormError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors({ code: "Enter the 6-digit code from your email." })
      return
    }
    setErrors({})
    setFormError("")
    setSubmitting(true)
    try {
      await confirmSignUp({ username: email, confirmationCode: code.trim() })
      await signIn({ username: email, password })
      toast.success("Email verified", { description: "Welcome to WorkBid!" })
      await goToDashboard()
    } catch (err) {
      setFormError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setFormError("")
    try {
      await resendSignUpCode({ username: email })
      toast.success("New code sent", { description: `Check ${email}.` })
    } catch (err) {
      setFormError(authErrorMessage(err))
    }
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it
            below to verify your account.
          </p>
        </div>

        <form onSubmit={handleConfirm}>
          <FieldGroup>
            <Field data-invalid={errors.code ? true : undefined}>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-invalid={errors.code ? true : undefined}
              />
              {errors.code ? (
                <FieldError>{errors.code}</FieldError>
              ) : (
                <FieldDescription>Can&apos;t find it? Check your spam folder.</FieldDescription>
              )}
            </Field>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Verifying…" : "Verify email"}
            </Button>
          </FieldGroup>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={handleResend} className="font-medium text-primary hover:underline">
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("form")
              setCode("")
              setFormError("")
            }}
            className="text-muted-foreground hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignup
            ? "Join WorkBid to post projects or bid on work near you."
            : "Sign in to manage your projects, bids, and messages."}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {isSignup && (
            <Field>
              <FieldLabel>I want to</FieldLabel>
              <ToggleGroup
                value={[role]}
                onValueChange={(value) => {
                  const next = value[0] as UserType | undefined
                  if (next) setSelectedRole(next)
                }}
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="client">Hire a pro</ToggleGroupItem>
                <ToggleGroupItem value="contractor">Find work</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          )}

          {isSignup && (
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={errors.firstName ? true : undefined}>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jordan"
                  aria-invalid={errors.firstName ? true : undefined}
                  autoComplete="given-name"
                />
                {errors.firstName && <FieldError>{errors.firstName}</FieldError>}
              </Field>
              <Field data-invalid={errors.lastName ? true : undefined}>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rivera"
                  aria-invalid={errors.lastName ? true : undefined}
                  autoComplete="family-name"
                />
                {errors.lastName && <FieldError>{errors.lastName}</FieldError>}
              </Field>
            </div>
          )}

          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={errors.email ? true : undefined}
              autoComplete="email"
            />
            {errors.email && <FieldError>{errors.email}</FieldError>}
          </Field>

          <Field data-invalid={errors.password ? true : undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              {!isSignup && (
                <Link href="#" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                aria-invalid={errors.password ? true : undefined}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {errors.password ? (
              <FieldError>{errors.password}</FieldError>
            ) : (
              isSignup && (
                <FieldDescription>
                  8+ characters with upper and lowercase letters, a number, and a symbol.
                </FieldDescription>
              )
            )}
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New to WorkBid? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-primary hover:underline"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  )
}
