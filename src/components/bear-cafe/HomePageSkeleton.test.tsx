import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePageSkeleton } from './HomePageSkeleton';
import { AppRoutes } from '@/App';
import { useAuth } from '@/lib/auth-context';

// Mock useAuth (Design Doc § Test Boundaries): only the AC-005 rerender case needs
// it; the a11y cases render <HomePageSkeleton /> directly with no providers.
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub the real Index page: mounting it would pull auth-dependent Supabase
// components (DailyCheckInCard, CommunityCarousel, CozySidebar) into jsdom.
// The AC-005 case only proves the gate swaps to the real route tree.
vi.mock('@/pages/Index', () => ({
  default: () => <div>INDEX_PAGE_STUB</div>,
}));

// The gate now wraps the skeleton in CozyAppShell whose real CozySidebar pulls
// useUserBalances (react-query + Supabase) into jsdom, so it is stubbed.
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

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('HomePageSkeleton accessibility contract (AC-006)', () => {
  it('exposes role="status" with the exact Thai accessible name and aria-busy', () => {
    render(<HomePageSkeleton />);

    const status = screen.getByRole('status', { name: 'กำลังโหลดหน้าหลัก' });
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the visible greeting ยินดีต้อนรับ', () => {
    render(<HomePageSkeleton />);

    expect(screen.getByText('ยินดีต้อนรับ')).toBeVisible();
  });

  it('contains zero focusable descendants', () => {
    const { container } = render(<HomePageSkeleton />);

    expect(container.querySelectorAll('button, a')).toHaveLength(0);
    const tabbable = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) >= 0,
    );
    expect(tabbable).toHaveLength(0);
  });
});

describe('AppRoutes loading-to-loaded handoff (AC-005)', () => {
  it('unmounts the skeleton and mounts the real route tree when isLoading resolves', () => {
    mockUseAuth.mockReturnValue(authState(true));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('status', { name: 'กำลังโหลดหน้าหลัก' }),
    ).toBeInTheDocument();

    mockUseAuth.mockReturnValue(authState(false));
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    // Direct swap: skeleton gone, real route element present — no blank frame.
    expect(
      screen.queryByRole('status', { name: 'กำลังโหลดหน้าหลัก' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('INDEX_PAGE_STUB')).toBeInTheDocument();
  });
});
