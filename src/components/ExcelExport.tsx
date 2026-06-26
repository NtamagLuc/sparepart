import { useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ExcelExportProps {
  type: 'requests' | 'reports' | 'history';
}

export function ExcelExport({ type }: ExcelExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const getTitle = () => {
    switch (type) {
      case 'requests': return 'Demandes';
      case 'reports': return 'Signalements';
      case 'history': return 'Historique';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let data: Record<string, unknown>[] = [];
      let filename = '';

      if (type === 'requests') {
        // Fetch requests
        const { data: requests, error: reqError } = await supabase
          .from('part_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        // Fetch related data separately
        const partIds = [...new Set(requests?.map(r => r.part_id) || [])];
        const userIds = [...new Set([
          ...(requests?.map(r => r.requester_id) || []),
          ...(requests?.filter(r => r.validator_id).map(r => r.validator_id!) || [])
        ])];

        const [partsResult, profilesResult] = await Promise.all([
          supabase.from('spare_parts').select('id, code, name').in('id', partIds),
          supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        ]);

        const partsMap = new Map((partsResult.data || []).map(p => [p.id, p]));
        const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

        data = (requests || []).map(r => {
          const part = partsMap.get(r.part_id);
          const requester = profilesMap.get(r.requester_id);
          const validator = r.validator_id ? profilesMap.get(r.validator_id) : null;

          return {
            'N° Demande': r.request_number,
            'Statut': r.status,
            'Urgence': r.urgency,
            'Motif': r.reason,
            'Quantité': r.quantity_requested,
            'Code Pièce': part?.code || '',
            'Nom Pièce': part?.name || '',
            'Équipement': r.equipment_name || '',
            'Description': r.description || '',
            'Justification': r.justification || '',
            'Demandeur': requester ? `${requester.first_name || ''} ${requester.last_name || ''}`.trim() : '',
            'Validateur': validator ? `${validator.first_name || ''} ${validator.last_name || ''}`.trim() : '',
            'Date création': r.created_at,
            'Date soumission': r.submitted_at || '',
            'Date validation': r.validated_at || '',
            'Motif rejet': r.rejection_reason || '',
          };
        });
        filename = `demandes_${new Date().toISOString().split('T')[0]}.xlsx`;

      } else if (type === 'reports') {
        const { data: reports, error: repError } = await supabase
          .from('part_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (repError) throw repError;

        const partIds = [...new Set(reports?.map(r => r.part_id) || [])];
        const userIds = [...new Set([
          ...(reports?.map(r => r.reporter_id) || []),
          ...(reports?.filter(r => r.resolved_by).map(r => r.resolved_by!) || [])
        ])];

        const [partsResult, profilesResult] = await Promise.all([
          supabase.from('spare_parts').select('id, code, name').in('id', partIds),
          supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        ]);

        const partsMap = new Map((partsResult.data || []).map(p => [p.id, p]));
        const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

        data = (reports || []).map(r => {
          const part = partsMap.get(r.part_id);
          const reporter = profilesMap.get(r.reporter_id);
          const resolver = r.resolved_by ? profilesMap.get(r.resolved_by) : null;

          return {
            'ID': r.id,
            'Type problème': r.issue_type,
            'Statut': r.status,
            'Code Pièce': part?.code || '',
            'Nom Pièce': part?.name || '',
            'Description': r.description,
            'Commentaire résolution': r.resolution_comment || '',
            'Signaleur': reporter ? `${reporter.first_name || ''} ${reporter.last_name || ''}`.trim() : '',
            'Résolu par': resolver ? `${resolver.first_name || ''} ${resolver.last_name || ''}`.trim() : '',
            'Date création': r.created_at,
            'Date résolution': r.resolved_at || '',
          };
        });
        filename = `signalements_${new Date().toISOString().split('T')[0]}.xlsx`;

      } else if (type === 'history') {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        data = (logs || []).map(l => ({
          'Date': l.created_at,
          'Action': l.action,
          'Type entité': l.entity_type,
          'ID entité': l.entity_id,
          'Utilisateur': l.user_name || '',
          'Anciennes valeurs': JSON.stringify(l.old_values || {}),
          'Nouvelles valeurs': JSON.stringify(l.new_values || {}),
        }));
        filename = `historique_${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, getTitle());
      XLSX.writeFile(workbook, filename);

      toast({ title: 'Export réussi', description: `${data.length} enregistrement(s) exporté(s)` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Erreur', description: 'Échec de l\'export', variant: 'destructive' });
    }

    setIsExporting(false);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (type === 'requests') {
        console.log('Imported requests data:', jsonData);
        toast({ 
          title: 'Import en cours', 
          description: `${jsonData.length} lignes lues. L'import des demandes nécessite une validation manuelle.` 
        });
      } else if (type === 'reports') {
        console.log('Imported reports data:', jsonData);
        toast({ 
          title: 'Import en cours', 
          description: `${jsonData.length} lignes lues. L'import des signalements nécessite une validation manuelle.` 
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Erreur', description: 'Échec de l\'import', variant: 'destructive' });
    }

    setIsImporting(false);
    event.target.value = '';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {(isExporting || isImporting) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Excel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Exporter {getTitle()}
        </DropdownMenuItem>
        {type !== 'history' && (
          <DropdownMenuItem asChild>
            <label className="cursor-pointer flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Importer {getTitle()}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                disabled={isImporting}
              />
            </label>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
