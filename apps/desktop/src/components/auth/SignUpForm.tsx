import { useState } from "react";
import { useAuthStore } from "@/stores";
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface SignUpFormProps {
  onSwitchToLogin: () => void;
}

export function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const { signUp, isLoading, error, clearError } = useAuthStore();

  const passwordsMatch = password === confirmPassword;
  const passwordValid = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim() || !password || !passwordsMatch || !passwordValid) return;

    const { error } = await signUp(email.trim(), password, name.trim() || undefined);
    if (!error) {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-[hsl(var(--primary))]" />
        </div>
        <h3 className="text-xl font-semibold">Check your email</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          We've sent you a confirmation link. Please check your inbox and click the link to verify your account.
        </p>
        <button
          onClick={onSwitchToLogin}
          className="text-sm text-[hsl(var(--primary))] font-medium hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] p-4 text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            Name <span className="text-[hsl(var(--muted-foreground))]">(optional)</span>
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-3 pl-12 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)/0.2)] transition-all"
              autoComplete="name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-3 pl-12 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)/0.2)] transition-all"
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-3 pl-12 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)/0.2)] transition-all"
              required
              autoComplete="new-password"
            />
          </div>
          {password && !passwordValid && (
            <p className="text-xs text-[hsl(var(--destructive))]">
              Password must be at least 8 characters
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full rounded-xl border bg-[hsl(var(--background))] py-3 pl-12 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:ring-2 transition-all ${
                confirmPassword && !passwordsMatch
                  ? "border-[hsl(var(--destructive))] focus:border-[hsl(var(--destructive))] focus:ring-[hsl(var(--destructive)/0.2)]"
                  : "border-[hsl(var(--border))] focus:border-[hsl(var(--ring))] focus:ring-[hsl(var(--ring)/0.2)]"
              }`}
              required
              autoComplete="new-password"
            />
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-[hsl(var(--destructive))]">
              Passwords don't match
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !email.trim() || !password || !passwordsMatch || !passwordValid}
        className="w-full rounded-xl bg-[hsl(var(--primary))] py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-[hsl(var(--primary)/0.2)]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </button>

      <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-[hsl(var(--primary))] font-medium hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
