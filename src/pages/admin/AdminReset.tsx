import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, History, FileText, Flag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function AdminReset() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isResettingRequests, setIsResettingRequests] = useState(false);
  const [isResettingReports, setIsResettingReports] = useState(false);
  const [isResettingHistory, setIsResettingHistory] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Accès refusé</h2>
        <p className="text-muted-foreground">Réservé aux administrateurs</p>
        <Button onClick={() => navigate('/')} className="mt-4">Retour</Button>
      </div>
    );
  }

  const handleResetRequests = async () => {
    setIsResettingRequests(true);
    const { error } = await supabase
      .from('part_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    setIsResettingRequests(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Demandes réinitialisées', description: 'Toutes les demandes ont été supprimées.' });
    }
  };

  const handleResetReports = async () => {
    setIsResettingReports(true);
    const { error } = await supabase
      .from('part_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    setIsResettingReports(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Signalements réinitialisés', description: 'Tous les signalements ont été supprimés.' });
    }
  };

  const handleResetHistory = async () => {
    setIsResettingHistory(true);
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    setIsResettingHistory(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Historique réinitialisé', description: 'L\'historique des activités a été supprimé.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Réinitialisation des données</h1>
        <p className="text-muted-foreground mt-1">Supprimer définitivement les données sélectionnées</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Reset Requests */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <FileText className="h-5 w-5" />
              Demandes
            </CardTitle>
            <CardDescription>Supprimer toutes les demandes de pièces</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2" disabled={isResettingRequests}>
                  {isResettingRequests ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Réinitialiser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera définitivement toutes les demandes de pièces. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetRequests} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Reset Reports */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Flag className="h-5 w-5" />
              Signalements
            </CardTitle>
            <CardDescription>Supprimer tous les signalements de pièces</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2" disabled={isResettingReports}>
                  {isResettingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Réinitialiser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera définitivement tous les signalements. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetReports} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Reset History */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <History className="h-5 w-5" />
              Historique
            </CardTitle>
            <CardDescription>Supprimer tout l'historique des activités</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2" disabled={isResettingHistory}>
                  {isResettingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Réinitialiser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera définitivement tout l'historique des activités. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-warning/5 border-warning/30">
        <CardContent className="flex items-start gap-4 pt-6">
          <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
          <div>
            <p className="font-medium text-warning">Attention</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ces actions sont irréversibles. Les données supprimées ne pourront pas être récupérées.
              Assurez-vous d'avoir exporté les données importantes avant de procéder.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
