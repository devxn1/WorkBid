"use client"

import { Amplify } from "aws-amplify"
import outputs from "@/amplify_outputs.json"

// Points the Amplify library at the backend the sandbox deployed (amplify_outputs.json).
// Runs once when this module loads; the component itself renders nothing.
Amplify.configure(outputs, { ssr: true })

export function ConfigureAmplify() {
  return null
}
