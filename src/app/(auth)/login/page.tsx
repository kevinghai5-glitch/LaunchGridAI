"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { LgButton } from "@/components/ui/lg-button";
import { Loader2, Mail } from "lucide-react";

// Input styled to match the dashboard's token system (see Library search field).
const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  background: "var(--bg-deep)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-2)",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-deep)" }}
    >
      <div className="absolute inset-0 bg-grid" style={{ opacity: 0.4 }} />
      <div
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{
          transform: "translate(-50%, -50%)",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "var(--accent-glow)",
          filter: "blur(110px)",
        }}
      />

      <div className="relative w-full max-w-md px-4">
        <div className="text-center" style={{ marginBottom: 32 }}>
          <Link href="/" className="inline-flex justify-center">
            <Logo size="md" />
          </Link>
          <h1
            className="lg-display"
            style={{
              marginTop: 24,
              marginBottom: 6,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-3)" }}>
            Sign in to your LaunchGrid account
          </p>
        </div>

        <div className="panel" style={{ padding: 32 }}>
          {/* Google button */}
          <LgButton
            variant="secondary"
            size="lg"
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{ width: "100%", marginBottom: 22 }}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </LgButton>

          <div className="flex items-center" style={{ gap: 12, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>
              or continue with email
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 16 }}>
            <div>
              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={fieldStyle}
              />
            </div>
            <LgButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              style={{ width: "100%", marginTop: 4 }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  Sign in
                </>
              )}
            </LgButton>
          </form>

          <p
            className="text-center"
            style={{ marginTop: 22, fontSize: 13, color: "var(--text-3)" }}
          >
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
