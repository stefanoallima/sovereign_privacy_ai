import { useState } from "react";
import { useAuthStore } from "@/stores";
import { Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const { resetPassword, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) return;

    const { error } = await resetPassword(email.trim());
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
          We've sent you a password reset link. Please check your inbox and follow the instructions to reset your password.
        </p>
        <button
          onClick={onBack}
          className="text-sm text-[hsl(var(--primary))] font-medium hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>

      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Reset your password</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] p-4 text-sm text-[hsl(var(--destructive))]">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

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

        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className="w-full rounded-xl bg-[hsl(var(--primary))] py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-[hsl(var(--primary)/0.2)]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>
    </div>
  );
}
