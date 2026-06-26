import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import StockList from "./pages/StockList";
import PartDetail from "./pages/PartDetail";
import RequestList from "./pages/RequestList";
import RequestDetail from "./pages/RequestDetail";
import NewRequest from "./pages/NewRequest";
import PartReports from "./pages/PartReports";
import NewPartReport from "./pages/NewPartReport";
import History from "./pages/History";
import Notifications from "./pages/Notifications";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserManagement from "./pages/admin/UserManagement";
import PartManagement from "./pages/admin/PartManagement";
import AdminReset from "./pages/admin/AdminReset";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock" element={<StockList />} />
              <Route path="/stock/:id" element={<PartDetail />} />
              <Route path="/requests" element={<RequestList />} />
              <Route path="/requests/new" element={<NewRequest />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/reports" element={<PartReports />} />
              <Route path="/reports/new" element={<NewPartReport />} />
              <Route path="/history" element={
                <ProtectedRoute requiredRoles={['maintenance_manager', 'admin']}>
                  <History />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={<Notifications />} />
              
              {/* Admin routes */}
              <Route path="/admin/users" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/parts" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <PartManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/reset" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <AdminReset />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
