import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface UrgencyBadgeProps {
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

const urgencyConfig = {
  low: {
    label: 'Basse',
    variant: 'secondary' as const,
    icon: ArrowDown,
  },
  medium: {
    label: 'Moyenne',
    variant: 'info' as const,
    icon: ArrowRight,
  },
  high: {
    label: 'Haute',
    variant: 'warning' as const,
    icon: ArrowUp,
  },
  critical: {
    label: 'Critique',
    variant: 'destructive' as const,
    icon: AlertTriangle,
  },
};

export function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
