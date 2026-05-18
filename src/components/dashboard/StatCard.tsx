import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "panel p-5 flex flex-col gap-3 hover:border-blue-500/20 transition-all duration-200",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-blue-400" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold text-white">{value}</div>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {trend && (
        <div className="text-xs text-green-400 font-medium">{trend}</div>
      )}
    </div>
  );
}
