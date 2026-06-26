import { useState, useEffect } from 'react';
import { 
  Users, 
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  KeyRound
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRoles {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  employee_id: string | null;
  created_at: string;
  roles: AppRole[];
}

const roleLabels: Record<AppRole, string> = {
  operator: 'Exploitant',
  maintenance_manager: 'Responsable Maintenance',
  admin: 'Administrateur',
};

const roleIcons: Record<AppRole, React.ElementType> = {
  operator: Shield,
  maintenance_manager: ShieldCheck,
  admin: ShieldAlert,
};

const roleColors: Record<AppRole, string> = {
  operator: 'secondary',
  maintenance_manager: 'default',
  admin: 'destructive',
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Role dialog
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('operator');
  const [isUpdating, setIsUpdating] = useState(false);

  // Create user dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('operator');
  const [isCreating, setIsCreating] = useState(false);

  // Delete user dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [userForPassword, setUserForPassword] = useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    const { data: allRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setIsLoading(false);
      return;
    }

    const usersWithRoles: UserWithRoles[] = profiles.map(profile => ({
      ...profile,
      roles: allRoles
        .filter(r => r.user_id === profile.id)
        .map(r => r.role as AppRole),
    }));

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      (user.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as AppRole);
    
    return matchesSearch && matchesRole;
  });

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    setIsUpdating(true);

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUser.id,
        role: selectedRole,
        assigned_by: currentUser?.id,
      });

    setIsUpdating(false);

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Rôle déjà attribué',
          description: 'Cet utilisateur possède déjà ce rôle.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erreur',
          description: 'Impossible d\'attribuer le rôle.',
          variant: 'destructive',
        });
      }
      return;
    }

    toast({
      title: 'Rôle attribué',
      description: `Le rôle ${roleLabels[selectedRole]} a été attribué.`,
    });

    setShowRoleDialog(false);
    fetchUsers();
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const user = users.find(u => u.id === userId);
    if (user && user.roles.length <= 1) {
      toast({
        title: 'Action impossible',
        description: 'Un utilisateur doit avoir au moins un rôle.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer le rôle.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Rôle retiré',
      description: `Le rôle ${roleLabels[role]} a été retiré.`,
    });

    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        title: 'Champs requis',
        description: 'Email et mot de passe sont obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    // Create user via edge function (admin action)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: newUserEmail,
        password: newUserPassword,
        first_name: newUserFirstName,
        last_name: newUserLastName,
        role: newUserRole,
      },
    });

    setIsCreating(false);

    if (error || data?.error) {
      toast({
        title: 'Erreur',
        description: data?.error || 'Impossible de créer l\'utilisateur.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Utilisateur créé',
      description: `${newUserFirstName} ${newUserLastName} a été créé avec succès.`,
    });

    setShowCreateDialog(false);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserFirstName('');
    setNewUserLastName('');
    setNewUserRole('operator');
    fetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Prevent self-deletion
    if (userToDelete.id === currentUser?.id) {
      toast({
        title: 'Action impossible',
        description: 'Vous ne pouvez pas supprimer votre propre compte.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: userToDelete.id },
    });

    setIsDeleting(false);
    setShowDeleteDialog(false);

    if (error || data?.error) {
      toast({
        title: 'Erreur',
        description: data?.error || 'Impossible de supprimer l\'utilisateur.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Utilisateur supprimé',
      description: 'L\'utilisateur a été supprimé avec succès.',
    });

    setUserToDelete(null);
    fetchUsers();
  };

  const handleResetPassword = async () => {
    if (!userForPassword || !newPassword) {
      toast({
        title: 'Mot de passe requis',
        description: 'Veuillez saisir un nouveau mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Mot de passe trop court',
        description: 'Le mot de passe doit contenir au moins 6 caractères.',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingPassword(true);

    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { 
        user_id: userForPassword.id,
        new_password: newPassword,
      },
    });

    setIsResettingPassword(false);
    setShowPasswordDialog(false);

    if (error || data?.error) {
      toast({
        title: 'Erreur',
        description: data?.error || 'Impossible de réinitialiser le mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Mot de passe réinitialisé',
      description: 'Le nouveau mot de passe a été défini.',
    });

    setUserForPassword(null);
    setNewPassword('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les utilisateurs et leurs rôles
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="operator">Exploitants</SelectItem>
                <SelectItem value="maintenance_manager">Responsables maintenance</SelectItem>
                <SelectItem value="admin">Administrateurs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilisateurs
          </CardTitle>
          <CardDescription>
            {filteredUsers.length} utilisateur(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => (
                <TableRow 
                  key={user.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {user.first_name || user.last_name 
                          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                          : 'Sans nom'
                        }
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.department || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {user.employee_id || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => {
                        const Icon = roleIcons[role];
                        return (
                          <Badge 
                            key={role} 
                            variant={roleColors[role] as any}
                            className="gap-1"
                          >
                            <Icon className="h-3 w-3" />
                            {roleLabels[role]}
                            {user.roles.length > 1 && (
                              <button
                                onClick={() => handleRemoveRole(user.id, role)}
                                className="ml-1 hover:text-destructive"
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        title="Ajouter un rôle"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowRoleDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        title="Réinitialiser le mot de passe"
                        onClick={() => {
                          setUserForPassword(user);
                          setShowPasswordDialog(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          title="Supprimer l'utilisateur"
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer un rôle</DialogTitle>
            <DialogDescription>
              Ajouter un rôle à {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent>
                {(['operator', 'maintenance_manager', 'admin'] as AppRole[])
                  .filter(role => !selectedUser?.roles.includes(role))
                  .map(role => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddRole} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Attribuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>
              Ajouter un nouvel utilisateur au système
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={newUserFirstName}
                  onChange={(e) => setNewUserFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={newUserLastName}
                  onChange={(e) => setNewUserLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="jean.dupont@exemple.fr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Exploitant</SelectItem>
                  <SelectItem value="maintenance_manager">Responsable Maintenance</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {userToDelete?.first_name} {userToDelete?.last_name} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Définir un nouveau mot de passe pour {userForPassword?.first_name} {userForPassword?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 caractères
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
