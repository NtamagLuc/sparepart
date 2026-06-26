import { RequestStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, FileEdit } from 'lucide-react';

interface StatusBadgeProps {
  status: RequestStatus;
}

const statusConfig = {
  draft: {
    label: 'Brouillon',
    variant: 'draft' as const,
    icon: FileEdit,
  },
  pending: {
    label: 'En attente',
    variant: 'pending' as const,
    icon: Clock,
  },
  approved: {
    label: 'Validée',
    variant: 'approved' as const,
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejetée',
    variant: 'rejected' as const,
    icon: XCircle,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
