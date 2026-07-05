import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // On success, the AuthProvider's onAuthStateChange listener swaps the view.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // If email confirmation is enabled, no session is returned yet.
        if (!data.session) {
          setConfirmSent(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-text">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            }}
          >
            S
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold gradient-text">Voxly</h1>
            <p className="max-w-xs text-sm text-text-muted">
              {mode === "signin"
                ? "Welcome back — sign in to keep practicing with Sofia."
                : "Create an account to start learning Spanish with Sofia."}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-lg">
          {confirmSent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail size={22} />
              </div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-text-muted">
                We sent a confirmation link to{" "}
                <span className="font-medium text-text">{email}</span>. Confirm
                your address, then come back to sign in.
              </p>
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => {
                  setConfirmSent(false);
                  setMode("signin");
                  setPassword("");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-text-muted"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5",
                    "text-sm text-text placeholder:text-text-dim",
                    "focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                    "transition-colors",
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-text-muted"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5",
                    "text-sm text-text placeholder:text-text-dim",
                    "focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                    "transition-colors",
                  )}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}

          {!confirmSent && (
            <p className="mt-4 text-center text-sm text-text-muted">
              {mode === "signin"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-primary transition-colors hover:text-primary-hover"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
