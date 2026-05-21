export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "Callback":
      return "Google sign-in failed. Please try again or use email.";
    case "OAuthAccountNotLinked":
      return "This email is already registered with a password. Sign in with email instead.";
    case "Configuration":
      return "Google sign-in is not configured on this server.";
    case "AccessDenied":
      return "Access denied.";
    case "CredentialsSignin":
      return "Invalid email or password.";
    case "SessionRequired":
      return "Please sign in to continue.";
    default:
      return "Sign in failed. Please try again.";
  }
}
