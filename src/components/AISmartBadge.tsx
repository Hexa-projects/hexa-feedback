import { Bot } from "lucide-react";

interface AISmartBadgeProps {
  agent?: string;
  className?: string;
}

export default function AISmartBadge({ agent = "AI", className = "" }: AISmartBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 ${className}`}
      title={`Monitorado por ${agent}`}
    >
      <Bot className="w-3 h-3" />
      {agent}
    </span>
  );
}
