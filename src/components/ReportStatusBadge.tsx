import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';

type ReportStatus = Database['public']['Enums']['report_status'];

interface ReportStatusBadgeProps {
  status: ReportStatus;
}

const statusConfig: Record<ReportStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  in_progress: { label: 'En cours', variant: 'default' },
  resolved: { label: 'Résolu', variant: 'success' },
  closed: { label: 'Fermé', variant: 'secondary' },
};

export function ReportStatusBadge({ status }: ReportStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
