import { useState } from "react";
import { useAuthStore } from "@/stores";
import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Bot, Wifi, WifiOff } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

type AuthView = "login" | "signup" | "forgot-password";

export function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");
  const { enableOfflineMode } = useAuthStore();
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_40%)] p-12">
        <div className="max-w-md text-white">
          <div className="mb-8">
            <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
              <Bot className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Private Assistant
          </h1>
          <p className="text-lg text-white/80 leading-relaxed">
            Your personal AI companion for coaching, therapy, and brainstorming.
            All your conversations are private and synced securely across devices.
          </p>
          <div className="mt-8 space-y-3">
            <Feature text="Private & secure conversations" />
            <Feature text="Sync across all your devices" />
            <Feature text="Works offline, syncs when online" />
            <Feature text="Multiple AI personas to choose from" />
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex flex-1 items-center justify-center p-8 bg-[hsl(var(--background))]">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center text-white shadow-lg mb-4">
              <Bot className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              Private Assistant
            </h1>
          </div>

          {/* Form Container */}
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-xl">
            {!supabaseConfigured ? (
              // No Supabase config - show offline mode only
              <div className="text-center space-y-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                  <WifiOff className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Offline Mode</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    No cloud sync configured. Your data will be stored locally on this device only.
                  </p>
                </div>
                <button
                  onClick={enableOfflineMode}
                  className="w-full rounded-xl bg-[hsl(var(--primary))] py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-all shadow-md shadow-[hsl(var(--primary)/0.2)]"
                >
                  Continue Offline
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                {view === "login" && (
                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold">Welcome back</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                      Sign in to sync your conversations
                    </p>
                  </div>
                )}
                {view === "signup" && (
                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold">Create an account</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                      Start syncing across all your devices
                    </p>
                  </div>
                )}

                {/* Forms */}
                {view === "login" && (
                  <LoginForm
                    onSwitchToSignUp={() => setView("signup")}
                    onForgotPassword={() => setView("forgot-password")}
                  />
                )}
                {view === "signup" && (
                  <SignUpForm onSwitchToLogin={() => setView("login")} />
                )}
                {view === "forgot-password" && (
                  <ForgotPasswordForm onBack={() => setView("login")} />
                )}

                {/* Divider */}
                {(view === "login" || view === "signup") && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[hsl(var(--border))]" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-[hsl(var(--card))] px-3 text-[hsl(var(--muted-foreground))]">
                          or
                        </span>
                      </div>
                    </div>

                    {/* Offline Mode Button */}
                    <button
                      onClick={enableOfflineMode}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-all"
                    >
                      <Wifi className="h-4 w-4" />
                      Continue without account
                    </button>
                    <p className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground)/0.7)]">
                      Data will only be stored locally on this device
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-white/90">{text}</span>
    </div>
  );
}
