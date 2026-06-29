import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "next-themes";
import { LoadingPage } from "@/components/bear-cafe/LoadingBear";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import CreateSessionPage from "./pages/CreateSessionPage";
import SessionHistoryPage from "./pages/SessionHistoryPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import AdminPage from "./pages/AdminPage";
import BannedPage from "./pages/BannedPage";
import RoleBannedPage from "./pages/RoleBannedPage";
import MaintenancePage from "./pages/MaintenancePage";
import NotFound from "./pages/NotFound";
import PointsPage from "./pages/PointsPage";
import DiscordServersPage from "./pages/DiscordServersPage";
import HealingMessagePage from "./pages/HealingMessagePage";
import ForStaffPage from "./pages/ForStaffPage";
import ForStaffReportPage from "./pages/ForStaffReportPage";
import BearBobaMergePage from "./pages/BearBobaMergePage";
import SpinPrizePage from "./pages/SpinPrizePage";
import FullCheckInCalendar from "./pages/FullCheckInCalendar";
import InventoryPage from "./pages/InventoryPage";
import GachaPage from "./pages/GachaPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requireOwner = false }: { children: React.ReactNode; requireOwner?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { enabledUsers, enabledStaff, maintenanceMessage, loading: maintenanceLoading } = useMaintenanceMode();

  if (isLoading || maintenanceLoading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason} isBannedRole={false} />;
  }

  if (enabledUsers) {
    const isOwner = user?.is_owner;
    const hasStaffAccess = (user?.allowed_pages?.length ?? 0) > 0;

    if (isOwner) {
      // Owner bypasses all maintenance
    } else if (enabledStaff) {
      return <MaintenancePage message={maintenanceMessage} />;
    } else if (!hasStaffAccess) {
      return <MaintenancePage message={maintenanceMessage} />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingPage />;

  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/" element={<Index />} />
      <Route path="/full-checkin-calendar" element={<FullCheckInCalendar />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/banned-role" element={<RoleBannedPage />} />

      <Route path="/create-session" element={<ProtectedRoute><CreateSessionPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
      <Route path="/points" element={<ProtectedRoute><PointsPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/discord-servers" element={<DiscordServersPage />} />
      <Route path="/healing-message" element={<ProtectedRoute><HealingMessagePage /></ProtectedRoute>} />
      <Route path="/forstaff" element={<ForStaffPage />} />
      <Route path="/forstaff/report" element={<ForStaffReportPage />} />
      <Route path="/bear-boba-merge" element={<BearBobaMergePage />} />
      <Route path="/games/bear-boba" element={<BearBobaMergePage />} />
      <Route path="/gacha" element={<GachaPage />} />
      <Route path="/spin-prize" element={<SpinPrizePage />} />
      <Route path="/admin" element={<ProtectedRoute><Navigate to="/admin/users" replace /></ProtectedRoute>} />
      <Route path="/admin/:section" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="bear-cafe-theme"
        enableSystem={false}
      >
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
