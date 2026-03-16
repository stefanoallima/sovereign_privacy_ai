import React from 'react';
import { Lock, Cloud, Eye, ShieldCheck, ShieldAlert, Loader2, Ban, Zap } from 'lucide-react';
import type { PrivacyStatus } from '@/hooks/usePrivacyChat';

export type PrivacyLevel = 'local-only' | 'anonymized' | 'public';

// Legacy interface for backward compatibility
interface LegacyPrivacyIndicatorProps {
    level: PrivacyLevel;
    piiTypesDetected?: string[]; // e.g., ['BSN', 'Phone']
    className?: string;
}

// New interface for privacy-aware chat status
interface PrivacyStatusIndicatorProps {
    status: PrivacyStatus;
    className?: string;
    showLabel?: boolean;
    showExplanation?: boolean;
}

type PrivacyIndicatorProps = LegacyPrivacyIndicatorProps | PrivacyStatusIndicatorProps;

// Type guard to check which props we received
function isPrivacyStatus(props: PrivacyIndicatorProps): props is PrivacyStatusIndicatorProps {
    return 'status' in props;
}

export const PrivacyIndicator: React.FC<PrivacyIndicatorProps> = (props) => {
    // Handle new PrivacyStatus-based props
    if (isPrivacyStatus(props)) {
        const { status, className = '', showLabel = true, showExplanation = false } = props;
        return <PrivacyStatusDisplay status={status} className={className} showLabel={showLabel} showExplanation={showExplanation} />;
    }

    // Legacy props handling
    const { level, piiTypesDetected = [], className = '' } = props;

    if (level === 'local-only') {
        return (
            <div className={`flex items-center gap-2 text-[hsl(var(--status-safe))] bg-[hsl(var(--status-safe-bg))] border border-[hsl(var(--status-safe-border))] px-2.5 py-1 rounded-lg text-xs font-semibold ${className}`} title="All data stays on your device. Encrypted at rest.">
                <Lock size={12} className="shrink-0" />
                <span className="tracking-tight uppercase text-[11px]">Local Vault</span>
            </div>
        );
    }

    if (level === 'anonymized') {
        return (
            <div className={`flex items-center gap-2 text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] px-2.5 py-1 rounded-lg text-xs font-semibold ${className}`} title={`Sensitive data (${piiTypesDetected.join(', ')}) replaced with placeholders before sending to cloud.`}>
                <ShieldCheck size={12} className="shrink-0" />
                <div className="flex flex-col leading-none">
                    <span className="tracking-tight uppercase text-[11px]">Anonymized</span>
                    {piiTypesDetected.length > 0 && (
                        <span className="text-[11px] opacity-70 font-medium">Hidden: {piiTypesDetected.join(', ')}</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border)/0.5)] px-2.5 py-1 rounded-lg text-xs font-semibold ${className}`}>
            <Cloud size={12} className="shrink-0" />
            <span className="tracking-tight uppercase text-[11px]">Cloud Standard</span>
        </div>
    );
};

// New component for PrivacyStatus display
const PrivacyStatusDisplay: React.FC<{
    status: PrivacyStatus;
    className?: string;
    showLabel?: boolean;
    showExplanation?: boolean;
}> = ({ status, className = '', showLabel = true, showExplanation = false }) => {
    const getModeConfig = () => {
        switch (status.mode) {
            case 'processing':
                return {
                    icon: <Loader2 size={12} className="animate-spin" />,
                    bgColor: 'bg-[hsl(var(--primary)/0.1)] dark:bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.2)]',
                    textColor: 'text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))]',
                };
            case 'attributes_only':
                return {
                    icon: <Lock size={12} />,
                    bgColor: 'bg-[hsl(var(--status-safe-bg))] border-[hsl(var(--status-safe-border))]',
                    textColor: 'text-[hsl(var(--status-safe))]',
                };
            case 'local':
                return {
                    icon: <Lock size={12} />,
                    bgColor: 'bg-[hsl(var(--status-safe-bg))] border-[hsl(var(--status-safe-border))]',
                    textColor: 'text-[hsl(var(--status-safe))]',
                };
            case 'anonymized':
                return {
                    icon: <ShieldCheck size={12} />,
                    bgColor: 'bg-[hsl(var(--primary)/0.1)] dark:bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.2)]',
                    textColor: 'text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))]',
                };
            case 'blocked':
                return {
                    icon: <Ban size={12} />,
                    bgColor: 'bg-[hsl(var(--status-danger-bg))] border-[hsl(var(--status-danger-border))]',
                    textColor: 'text-[hsl(var(--status-danger))]',
                };
            case 'direct':
                return {
                    icon: <Zap size={12} />,
                    bgColor: 'bg-[hsl(var(--status-caution-bg))] border-[hsl(var(--status-caution-border))]',
                    textColor: 'text-[hsl(var(--status-caution))]',
                };
            default:
                return {
                    icon: <Cloud size={12} />,
                    bgColor: 'bg-[hsl(var(--muted)/0.5)] border-[hsl(var(--border)/0.5)]',
                    textColor: 'text-[hsl(var(--muted-foreground))] dark:text-[hsl(var(--muted-foreground))]',
                };
        }
    };

    const config = getModeConfig();

    return (
        <div
            className={`flex items-center gap-2 ${config.bgColor} ${config.textColor} border px-2.5 py-1 rounded-lg text-xs font-semibold ${className} transition-all duration-300`}
            title={status.explanation}
        >
            {config.icon}
            {showLabel && (
                <div className="flex flex-col leading-none">
                    <span className="tracking-tight uppercase text-[11px]">{status.label}</span>
                    {status.attributesCount !== undefined && (
                        <span className="text-[11px] opacity-70 font-medium">{status.attributesCount} attributes matched</span>
                    )}
                </div>
            )}
            {status.hadFallback && (
                <span title="Fallback occurred">
                    <ShieldAlert size={10} className="text-orange-500" />
                </span>
            )}
            {showExplanation && (
                <span className="text-[11px] opacity-70 ml-1 font-medium italic">{status.explanation}</span>
            )}
        </div>
    );
};

export const AnonymizationAuditLog: React.FC<{ original: string; anonymized: string }> = ({ original, anonymized }) => {
    const [showOriginal, setShowOriginal] = React.useState(false);

    return (
        <div className="mt-3 text-[11px] border border-[hsl(var(--border)/0.5)] rounded-2xl p-4 bg-[hsl(var(--secondary)/0.15)] backdrop-blur-sm overflow-hidden animate-fade-in group">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] ">
                        <ShieldCheck size={12} />
                    </div>
                    <span className="font-bold text-[hsl(var(--foreground))] uppercase tracking-tight">Privacy Audit Log</span>
                </div>
                <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="text-[10px] font-bold text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.8)] flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--card))] dark:bg-black/20 rounded-xl shadow-sm border border-[hsl(var(--border)/0.3)] transition-all active:scale-95"
                >
                    {showOriginal ? <><Eye size={12} /> Hide Sensitive Data</> : <><ShieldAlert size={12} /> Reveal Local Original</>}
                </button>
            </div>

            <div className="space-y-3">
                <div className="p-3 bg-[hsl(var(--card))] dark:bg-black/20 border border-[hsl(var(--border)/0.5)] rounded-xl shadow-inner-sm">
                    <div className="text-[9px] font-bold uppercase text-[hsl(var(--muted-foreground))] opacity-50 mb-2 flex items-center justify-between">
                        <span>Transmission (Anonymized)</span>
                        <span className="text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">Safe For Cloud</span>
                    </div>
                    <code className="block whitespace-pre-wrap text-[hsl(var(--foreground))] font-mono text-[10px] break-all leading-relaxed">
                        {anonymized}
                    </code>
                </div>

                {showOriginal && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl animate-slide-down">
                        <div className="text-[9px] font-bold uppercase text-red-400 mb-2 flex items-center justify-between">
                            <span>Local Identity (Cleartext)</span>
                            <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">Machine Only</span>
                        </div>
                        <code className="block whitespace-pre-wrap text-red-800 dark:text-red-400 font-mono text-[10px] break-all leading-relaxed">
                            {original}
                        </code>
                    </div>
                )}
            </div>

            <div className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))] opacity-50 font-medium italic text-center">
                Encryption standard: ChaCha20-Poly1305 AEAD • Key stored in Windows Credential Manager
            </div>
        </div>
    );
};
