import { Lock, Zap, Globe } from "lucide-react";

export function BenefitIcons() {
  return (
    <div className="flex items-center justify-center gap-12 md:gap-16 mt-12">
      <Lock className="h-8 w-8 text-primary" strokeWidth={1.5} />
      <Zap className="h-8 w-8 text-primary" strokeWidth={1.5} />
      <Globe className="h-8 w-8 text-primary" strokeWidth={1.5} />
    </div>
  );
}
