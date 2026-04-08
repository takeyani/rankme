import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdviceCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

export function AdviceCard({
  title,
  description,
  icon,
  className,
}: AdviceCardProps) {
  return (
    <Card className={cn("border-l-4 border-l-[var(--accent)]", className)}>
      <CardContent className="flex items-start gap-4 p-4 md:p-5">
        {icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)]/10 text-[var(--accent)]">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
            {title}
          </h4>
          <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
