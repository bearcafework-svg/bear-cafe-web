import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "next-themes";
import { LoadingPage } from "@/components/bear-cafe/LoadingBear";
import { CozyAppShell } from "@/components/bear-cafe/CozyAppShell";
import { HomePageSkeleton } from "@/components/bear-cafe/HomePageSkeleton";
import { GachaPageSkeleton, PointsPageSkeleton, FullCheckInCalendarSkeleton } from "@/components/bear-cafe/PageSkeletons";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import AdminPage from "./pages/AdminPage";
import BannedPage from "./pages/BannedPage";
import RoleBannedPage from "./pages/RoleBannedPage";
import MaintenancePage from "./pages/MaintenancePage";
import NotFound from "./pages/NotFound";
import PointsPage from "./pages/PointsPage";
import DiscordServersPage from "./pages/DiscordServersPage";
import HealingMessagePage from "./pages/HealingMessagePage";
import SpinPrizePage from "./pages/SpinPrizePage";
import FullCheckInCalendar from "./pages/FullCheckInCalendar";
import InventoryPage from "./pages/InventoryPage";
import GachaPage from "./pages/GachaPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

// Routes with a content-shaped skeleton during the auth gate. Only the content
// section is skeletonized — the real CozySidebar renders next to it via
// CozyAppShell. Every other pathname keeps the generic LoadingPage.
const GATE_CONTENT_SKELETONS: Record<string, () => JSX.Element> = {
  '/': HomePageSkeleton,
  '/gacha': GachaPageSkeleton,
  '/points': PointsPageSkeleton,
  '/full-checkin-calendar': FullCheckInCalendarSkeleton,
};

/**
 * Keeps one CozyAppShell mounted across auth-loading → page content so the
 * sidebar and shell chrome do not remount (that remount caused skeleton flicker).
 */
function CozyGateLayout() {
  const { isLoading } = useAuth();
  const location = useLocation();
  const ContentSkeleton = GATE_CONTENT_SKELETONS[location.pathname];

  return (
    <CozyAppShell
      contentClassName={
        location.pathname === '/' || location.pathname === '/full-checkin-calendar'
          ? 'min-h-screen'
          : undefined
      }
    >
      {isLoading && ContentSkeleton ? <ContentSkeleton /> : <Outlet />}
    </CozyAppShell>
  );
}

/**
 * Protected /points with a stable shell: auth/maintenance loading swaps only
 * the content skeleton; ban/login/maintenance exits replace the whole tree
 * (outside the shell) so they stay full-page.
 */
function PointsGateRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { enabledUsers, enabledStaff, maintenanceMessage, loading: maintenanceLoading } =
    useMaintenanceMode();

  const booting = isLoading || maintenanceLoading;

  if (!booting) {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.is_banned) {
      return <BannedPage reason={user.ban_reason} isBannedRole={false} />;
    }
    if (enabledUsers) {
      const isOwner = user?.is_owner;
      const hasStaffAccess = (user?.allowed_pages?.length ?? 0) > 0;
      if (!isOwner && (enabledStaff || !hasStaffAccess)) {
        return <MaintenancePage message={maintenanceMessage} />;
      }
    }
  }

  return (
    <CozyAppShell>
      {booting ? <PointsPageSkeleton /> : <PointsPage />}
    </CozyAppShell>
  );
}

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const ContentSkeleton = GATE_CONTENT_SKELETONS[location.pathname];

  // Non-shell paths still use the full-page loader while auth boots.
  // Shell paths always enter Routes so the layout can keep the shell stable.
  if (isLoading && !ContentSkeleton) {
    return <LoadingPage />;
  }

  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/banned-role" element={<RoleBannedPage />} />

      <Route element={<CozyGateLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/gacha" element={<GachaPage />} />
        <Route path="/full-checkin-calendar" element={<FullCheckInCalendar />} />
      </Route>
      <Route path="/points" element={<PointsGateRoute />} />

      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/discord-servers" element={<DiscordServersPage />} />
      <Route path="/healing-message" element={<ProtectedRoute><HealingMessagePage /></ProtectedRoute>} />
      <Route path="/spin-prize" element={<SpinPrizePage />} />
      <Route path="/admin" element={<ProtectedRoute><Navigate to="/admin/overview" replace /></ProtectedRoute>} />
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
