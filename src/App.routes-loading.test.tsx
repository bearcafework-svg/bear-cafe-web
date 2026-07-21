import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { useAuth } from '@/lib/auth-context';

// Mock useAuth (Design Doc § Test Boundaries): controls isLoading without a real
// Supabase session. AuthProvider is included so importing App.tsx stays valid.
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The gate renders the real CozyAppShell (real sidebar, skeleton content).
// CozySidebar pulls useUserBalances (react-query + Supabase) into jsdom, so it
// is stubbed; the tests only assert the sidebar slot is the real component.
vi.mock('@/components/bear-cafe/CozySidebar', () => ({
  CozySidebar: () => <div data-testid="cozy-sidebar" />,
  COZY_SIDEBAR_WIDTH: 272,
}));

const mockUseAuth = vi.mocked(useAuth);

function authState(isLoading: boolean): ReturnType<typeof useAuth> {
  return {
    user: null,
    session: null,
    isLoading,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };
}

beforeAll(() => {
  // jsdom does not implement matchMedia; LoadingBear's useIsMobile needs it.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('AppRoutes auth-loading gate (AC-001 / AC-002)', () => {
  it.each([
    ['/', 'กำลังโหลดหน้าหลัก'],
    ['/gacha', 'กำลังโหลดหน้ากาชา'],
    ['/points', 'กำลังโหลดหน้ากรอกโค้ด'],
  ])(
    'renders the content skeleton with the real sidebar while auth is loading on %s',
    (pathname, label) => {
      mockUseAuth.mockReturnValue(authState(true));

      render(
        <MemoryRouter initialEntries={[pathname]}>
          <AppRoutes />
        </MemoryRouter>
      );

      expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
      // The sidebar slot renders the real CozySidebar, not a skeleton.
      expect(screen.getByTestId('cozy-sidebar')).toBeInTheDocument();
      // Generic LoadingPage UI (LoadingBear's default message) must be absent.
      expect(screen.queryByText('กำลังโหลด...')).not.toBeInTheDocument();
    },
  );

  it('renders the unchanged generic LoadingPage while auth is loading on /login', () => {
    mockUseAuth.mockReturnValue(authState(true));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'กำลังโหลดหน้าหลัก' })
    ).not.toBeInTheDocument();
  });
});
