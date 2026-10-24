import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  variation?: number;
  icon: React.ReactNode;
  subtitle?: string;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  variation,
  icon,
  subtitle,
  tooltip
}) => {
  const isPositive = variation !== undefined && variation > 0;
  const isNegative = variation !== undefined && variation < 0;
  const isZero = variation !== undefined && variation === 0;

  return (
    <div
      title={tooltip}
      className="p-5 bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {variation !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs font-semibold">
          {isPositive && (
            <span className="flex items-center text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+{variation}%
            </span>
          )}
          {isNegative && (
            <span className="flex items-center text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />{variation}%
            </span>
          )}
          {isZero && (
            <span className="flex items-center text-slate-400">
              <Minus className="w-3.5 h-3.5 mr-0.5" />0%
            </span>
          )}
          <span className="text-slate-400 font-normal">vs. período anterior</span>
        </div>
      )}
    </div>
  );
};
