import React from 'react';
import { CheckCircle2, Circle, Loader2, FileText } from 'lucide-react';

interface FormFillProgressProps {
  currentStep: string;
  filename: string;
}

const STEPS = [
  { key: 'parsing', label: 'Parsing document' },
  { key: 'extracting', label: 'Extracting form fields' },
  { key: 'matching', label: 'Matching to profile' },
  { key: 'gap-filling', label: 'Collecting missing info' },
  { key: 'composing', label: 'Composing responses' },
  { key: 'reviewing', label: 'Ready for review' },
];

function getStepStatus(stepKey: string, currentStep: string): 'completed' | 'current' | 'pending' {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const stepIndex = STEPS.findIndex((s) => s.key === stepKey);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'pending';
}

export const FormFillProgress: React.FC<FormFillProgressProps> = ({ currentStep, filename }) => {
  return (
    <div className="group relative flex gap-4 flex-row">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] shadow-sm text-lg">
          <FileText className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col max-w-[85%] items-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm leading-relaxed w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="font-semibold text-[13px] text-[hsl(var(--foreground)/0.9)]">
              Form Fill
            </span>
          </div>

          {/* Filename */}
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--violet)/0.07)] border border-[hsl(var(--violet)/0.2)]">
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--violet))]" />
            <span className="text-[12px] font-medium text-[hsl(var(--foreground-muted))] truncate">
              {filename}
            </span>
          </div>

          {/* Steps */}
          <div className="px-4 pb-4 space-y-2">
            {STEPS.map((step) => {
              const status = getStepStatus(step.key, currentStep);
              return (
                <div key={step.key} className="flex items-center gap-2.5">
                  {status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                  {status === 'current' && (
                    <Loader2 className="h-4 w-4 text-[hsl(var(--primary))] animate-spin flex-shrink-0" />
                  )}
                  {status === 'pending' && (
                    <Circle className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.3)] flex-shrink-0" />
                  )}
                  <span
                    className={`text-[13px] ${
                      status === 'completed'
                        ? 'text-[hsl(var(--foreground)/0.6)]'
                        : status === 'current'
                          ? 'text-[hsl(var(--foreground))] font-medium'
                          : 'text-[hsl(var(--muted-foreground)/0.4)]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormFillProgress;
