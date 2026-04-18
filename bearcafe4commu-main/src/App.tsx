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
import LotteryPage from "./pages/LotteryPage";
import GachaPage from "./pages/GachaPage";
import DiscordServersPage from "./pages/DiscordServersPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requireOwner = false }: { children: React.ReactNode; requireOwner?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { enabledUsers, enabledStaff, maintenanceMessage, loading: maintenanceLoading } = useMaintenanceMode();

  // รอทั้ง auth และ maintenance โหลดเสร็จก่อน
  // ถ้า authenticated แต่ user ยังเป็น null = profile กำลัง fetch → รอด้วย
  if (isLoading || maintenanceLoading || (isAuthenticated && !user)) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Check if user is banned
  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason} isBannedRole={false} />;
  }

  // Check maintenance mode — owner (is_owner) bypass ทุกกรณีเสมอ
  if (enabledUsers && !user?.is_owner) {
    const hasStaffAccess = user?.is_admin || (user?.allowed_pages?.length ?? 0) > 0;

    if (enabledStaff || !hasStaffAccess) {
      // Staff ถูก block ด้วย หรือ user ทั่วไป
      return <MaintenancePage message={maintenanceMessage} />;
    }
    // Staff ที่มีสิทธิ์ผ่านได้เมื่อ enabledStaff = false
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingPage />;
  
  return (
    <Routes>
      {/* Public landing page - no auth required */}
      <Route path="/welcome" element={<LandingPage />} />
      
      {/* Main dashboard - viewable without auth, actions require login */}
      <Route path="/" element={<Index />} />
      
      {/* Login page */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      
      {/* OAuth callback handler */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Role banned page */}
      <Route path="/banned-role" element={<RoleBannedPage />} />
      
      {/* Protected routes */}
      <Route path="/create-session" element={<ProtectedRoute><CreateSessionPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
      <Route path="/points" element={<ProtectedRoute><PointsPage /></ProtectedRoute>} />
      <Route path="/lottery" element={<ProtectedRoute><LotteryPage /></ProtectedRoute>} />
      <Route path="/gacha" element={<ProtectedRoute><GachaPage /></ProtectedRoute>} />
      <Route path="/discord-servers" element={<DiscordServersPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/lottery" element={<ProtectedRoute requireOwner={false}><AdminPage /></ProtectedRoute>} />
      
      
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
