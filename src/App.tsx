import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "next-themes";
import { LoadingPage } from "@/components/bear-cafe/LoadingBear";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MusicProvider } from "@/lib/music-context";
import { FloatingMiniPlayer } from "@/components/bear-cafe/FloatingMiniPlayer";
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
import HealingMessagePage from "./pages/HealingMessagePage";
import MeeDooDuang from "./pages/MeeDooDuang";
import ForStaffPage from "./pages/ForStaffPage";
import ForStaffReportPage from "./pages/ForStaffReportPage";
import SecretChatMenu from "./pages/SecretChatMenu";
import SecretChatRoom from "./pages/SecretChatRoom";
import BearBobaMergePage from "./pages/BearBobaMergePage";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requireOwner = false }: { children: React.ReactNode; requireOwner?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { enabledUsers, enabledStaff, maintenanceMessage, loading: maintenanceLoading } = useMaintenanceMode();
  
  if (isLoading || maintenanceLoading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // Check if user is banned
  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason} isBannedRole={false} />;
  }

  // Check maintenance mode
  if (enabledUsers) {
    const isOwner = user?.is_owner;
    const hasStaffAccess = (user?.allowed_pages?.length ?? 0) > 0;

    if (isOwner) {
      // Owner bypasses all maintenance
    } else if (enabledStaff) {
      // Staff blocked too → everyone except Owner sees maintenance
      return <MaintenancePage message={maintenanceMessage} />;
    } else if (!hasStaffAccess) {
      // Only regular users blocked
      return <MaintenancePage message={maintenanceMessage} />;
    }
    // Staff with permissions can pass when enabledStaff is false
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
      <Route path="/healing-message" element={<ProtectedRoute><HealingMessagePage /></ProtectedRoute>} />
      <Route path="/meedooduang" element={<MeeDooDuang />} />
      <Route path="/forstaff" element={<ForStaffPage />} />
      <Route path="/forstaff/report" element={<ForStaffReportPage />} />
      <Route path="/secret-chat" element={<ProtectedRoute><SecretChatMenu /></ProtectedRoute>} />
      <Route path="/secret-chat/room" element={<ProtectedRoute><SecretChatRoom /></ProtectedRoute>} />
      <Route path="/bear-boba-merge" element={<BearBobaMergePage />} />
      <Route path="/games/bear-boba" element={<BearBobaMergePage />} />
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
            <MusicProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
                <FloatingMiniPlayer />
              </TooltipProvider>
            </MusicProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
