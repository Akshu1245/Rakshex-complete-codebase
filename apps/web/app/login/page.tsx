/* Design reminder: Trust Ledger — a focused, calm product entry page that keeps sign in primary and product value secondary. */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Check, CircleAlert, LockKeyhole, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PasswordField } from "@/components/PasswordField";

function EntryMark() {
  return (
    <span className="rx-entry-mark" aria-hidden="true">
      <i />
    </span>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const oauthError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(
    oauthError ? "Sign in could not be completed. Please try again." : null,
  );
  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.requires2FA && data.userId) {
        router.push(`/mfa?userId=${data.userId}`);
        return;
      }
      router.push(redirect);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    login.mutate({ email: email.trim(), password });
  };
  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: redirect });
    } catch {
      setError(`Unable to sign in with ${provider}. Please try again.`);
      setOauthLoading(null);
    }
  };

  return (
    <div className="rx-entry-page">
      <section className="rx-entry-story">
        <Link href="/" className="rx-entry-brand">
          <EntryMark />
          <span>
            Raks<span>Hex</span>
          </span>
        </Link>
        <div className="rx-entry-story-copy">
          <p className="rx-kicker">
            <span /> Secure workspace entry
          </p>
          <h1>Sign in to the place where AI actions become accountable.</h1>
          <p>
            Keep your first rollout narrow, establish the control path, and make every decision
            explainable to the people responsible for the outcome.
          </p>
        </div>
        <div className="rx-entry-principles">
          <div>
            <ShieldCheck size={17} />
            <span>
              <b>Start in Shadow</b>See policy results before you enforce them.
            </span>
          </div>
          <div>
            <LockKeyhole size={17} />
            <span>
              <b>Broker with intention</b>Move sensitive credentials only when the path is ready.
            </span>
          </div>
          <div>
            <Check size={17} />
            <span>
              <b>Keep evidence</b>Trace the authority, decision, and outcome for each action.
            </span>
          </div>
        </div>
        <p className="rx-entry-footer">
          RaksHex controls brokered action paths. Direct keys and unbrokered tools remain outside
          its enforcement boundary.
        </p>
      </section>
      <section className="rx-entry-form-shell">
        <div className="rx-entry-form-wrap">
          <Link href="/" className="rx-back-home">
            <ArrowLeft size={15} /> Back to overview
          </Link>
          <div className="rx-entry-heading">
            <p className="rx-kicker">Workspace sign in</p>
            <h2>Welcome back.</h2>
            <p>Use your organization account to enter your RaksHex workspace.</p>
          </div>
          {error && (
            <div className="rx-entry-error">
              <CircleAlert size={16} />
              {error}
            </div>
          )}
          <div className="rx-oauth-row">
            <button onClick={() => handleOAuth("google")} disabled={oauthLoading !== null}>
              {oauthLoading === "google" ? (
                <span className="rx-spinner" />
              ) : (
                <span className="rx-google-g">G</span>
              )}{" "}
              {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
            </button>
            <button onClick={() => handleOAuth("github")} disabled={oauthLoading !== null}>
              {oauthLoading === "github" ? (
                <span className="rx-spinner rx-spinner-dark" />
              ) : (
                <span className="rx-github-mark">●</span>
              )}{" "}
              {oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
            </button>
          </div>
          <div className="rx-entry-divider">
            <span>or use email</span>
          </div>
          <form onSubmit={handleSubmit} className="rx-entry-form">
            <label>
              Email
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <PasswordField
                id="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <Link href="/forgot-password" className="rx-forgot">
              Forgot password?
            </Link>
            <button type="submit" disabled={login.isPending} className="rx-entry-submit">
              {login.isPending ? "Signing in…" : "Sign in to workspace"}
            </button>
          </form>
          <p className="rx-entry-register">
            New to RaksHex? <Link href="/register">Create your workspace</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rx-entry-loading">Loading secure entry…</div>}>
      <LoginForm />
    </Suspense>
  );
}
