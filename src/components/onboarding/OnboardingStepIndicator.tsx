import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface OnboardingStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function OnboardingStepIndicator({ steps, currentStep }: OnboardingStepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2",
                  isDone && "bg-primary text-primary-foreground border-primary",
                  isActive && "border-primary text-primary bg-primary/10 scale-110 shadow-md",
                  !isDone && !isActive && "border-muted text-muted-foreground bg-muted/50"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : step.icon}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight max-w-[72px]",
                  isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 mb-5">
                <div className={cn("h-0.5 rounded-full transition-all", isDone ? "bg-primary" : "bg-border")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
