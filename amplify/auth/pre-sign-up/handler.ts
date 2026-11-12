// Only the fields of the Cognito pre sign-up event we touch.
interface PreSignUpEvent {
  request: { userAttributes: Record<string, string> }
  response: { autoConfirmUser: boolean; autoVerifyEmail: boolean; autoVerifyPhone: boolean }
}

/** Skip email verification: confirm the user and mark their email as verified. */
export const handler = async (event: PreSignUpEvent) => {
  event.response.autoConfirmUser = true
  if (event.request.userAttributes.email) event.response.autoVerifyEmail = true
  return event
}
