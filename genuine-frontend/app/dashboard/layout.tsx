'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, CircleDollarSign, Eye, FileBarChart2, ImagePlus, LayoutDashboard, LifeBuoy, Loader2, LogOut, MapPin, Menu, Package, Receipt, Settings2, ShoppingCart, Store, Trash2, Truck, UserRound, UsersRound, Warehouse, X, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authAPI, getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RouteTransitionOverlay } from './RouteTransitionOverlay';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { SessionTimeoutGuard } from '@/components/auth/SessionTimeoutGuard';
import { workspaceAPI, type WorkspaceLocation } from '@/lib/api/workspace';
import { readSavedLocationId, useWorkspaceStore } from '@/store/workspaceStore';
import { settingsAPI } from '@/lib/api/settings';
import { useTheme } from 'next-themes';
import { cacheBusinessDateSettings } from '@/lib/format/businessDate';
import { useBusinessProfileStore } from '@/store/businessProfileStore';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}><DashboardLayoutContent>{children}</DashboardLayoutContent></Suspense>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const initialize = useAuthStore((state) => state.initialize);
  const logout = useAuthStore((state) => state.logout);
  const expireSession = useAuthStore((state) => state.expireSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const syncToken = useAuthStore((state) => state.syncToken);
  const { setTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedNavGroups, setCollapsedNavGroups] = useState<Record<string, boolean>>({});
  const [isDesktop, setIsDesktop] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const activeLocation = useWorkspaceStore((state) => state.activeLocation);
  const setActiveLocation = useWorkspaceStore((state) => state.setActiveLocation);
  const businessBrand = useBusinessProfileStore((state) => state.businessId === user?.businessId ? state.brand : null);
  const setBusinessProfile = useBusinessProfileStore((state) => state.setProfile);
  const setBusinessBrand = useBusinessProfileStore((state) => state.setBrand);
  const [workspaceLogoFailed, setWorkspaceLogoFailed] = useState(false);
  const [workspaceLocations, setWorkspaceLocations] = useState<WorkspaceLocation[]>([]);
  const [pendingLocation, setPendingLocation] = useState<WorkspaceLocation | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationMenuPosition, setLocationMenuPosition] = useState({ left: 12, top: 12 });
  const locationButtonRef = useRef<HTMLButtonElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const avatarPreviewCloseButton = useRef<HTMLButtonElement>(null);
  const avatarObjectUrl = useRef<string | null>(null);

  const replaceAvatarUrl = useCallback((nextUrl: string | null) => {
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current);
    avatarObjectUrl.current = nextUrl;
    setAvatarUrl(nextUrl);
  }, []);
  const compactSidebar = isDesktop && sidebarCollapsed;

  useEffect(() => {
    if (!user?.businessId || (!user.permissions.includes('settings.view') && !user.permissions.includes('settings.edit'))) return;
    // Load business date/time preferences every time; apply business theme only when the user has no local override.
    let live = true;
    Promise.all([settingsAPI.getGeneral(), settingsAPI.getProfile()]).then(([settings, profile]) => {
      if (!live) return;
      setBusinessProfile(user.businessId, profile);
      cacheBusinessDateSettings({ ...settings, timezone: profile.timezone, language: profile.language, financialYear: profile.financialYear });
      if (!window.localStorage.getItem('genuine.theme')) setTheme(settings.theme.toLowerCase());
    }).catch(() => undefined);
    return () => { live = false; };
  }, [user?.businessId, user?.permissions, setTheme, setBusinessProfile]);

  useEffect(() => {
    if (!user?.businessId) return;
    let live = true;
    settingsAPI.getBrand().then((brand) => { if (live) setBusinessBrand(user.businessId, brand); }).catch(() => undefined);
    return () => { live = false; };
  }, [user?.businessId, setBusinessBrand]);

  useEffect(() => { setWorkspaceLogoFailed(false); }, [businessBrand?.logoUrl]);

  useEffect(() => {
    if (!user?.businessId || !user.id) return;
    let live = true;
    setLocationsLoading(true);
    workspaceAPI.locations().then((locations) => {
      if (!live) return;
      setWorkspaceLocations(locations);
      const savedId = readSavedLocationId(user.businessId, user.id);
      const selected = locations.find((location) => location.id === savedId) || locations[0];
      if (selected) setActiveLocation(selected, user.businessId, user.id);
    }).catch(() => {
      if (live) setWorkspaceLocations([]);
    }).finally(() => {
      if (live) setLocationsLoading(false);
    });
    return () => { live = false; };
  }, [user?.businessId, user?.id, setActiveLocation]);

  useEffect(() => { setLocationMenuOpen(false); setPendingLocation(null); }, [pathname]);

  useEffect(() => {
    if (!locationMenuOpen) return;
    const closeOnOutsideOrEscape = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') { setLocationMenuOpen(false); setPendingLocation(null); }
      if (event instanceof MouseEvent && !locationMenuRef.current?.contains(event.target as Node) && !locationButtonRef.current?.contains(event.target as Node)) { setLocationMenuOpen(false); setPendingLocation(null); }
    };
    document.addEventListener('mousedown', closeOnOutsideOrEscape);
    document.addEventListener('keydown', closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideOrEscape);
      document.removeEventListener('keydown', closeOnOutsideOrEscape);
    };
  }, [locationMenuOpen]);

  function toggleLocationMenu() {
    if (locationMenuOpen) {
      setLocationMenuOpen(false);
      setPendingLocation(null);
      return;
    }
    const rect = locationButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(330, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 372));
      setLocationMenuPosition({ left, top });
    }
    setLocationMenuOpen(true);
  }

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('genuine.dashboardSidebarCollapsed') === 'true');
    const media = window.matchMedia('(min-width: 1024px)');
    const updateViewport = () => setIsDesktop(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem('genuine.dashboardSidebarCollapsed', String(next));
      return next;
    });
  }

  useEffect(() => {
    if (status === 'loading') void initialize();
  }, [status, initialize]);

  useEffect(() => {
    const sync = () => syncToken();
    window.addEventListener('genuine:token-refreshed', sync);
    return () => window.removeEventListener('genuine:token-refreshed', sync);
  }, [syncToken]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('mizania-auth');
    channel.onmessage = (event) => {
      if (event.data?.type === 'session-ended') {
        expireSession();
        router.replace('/login?reason=session-expired');
      }
    };
    return () => channel.close();
  }, [expireSession, router]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (user?.avatar) {
      void authAPI.getAvatar().then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        avatarObjectUrl.current = objectUrl;
        setAvatarUrl(objectUrl);
      }).catch(() => {
        if (active) replaceAvatarUrl(null);
      });
    } else replaceAvatarUrl(null);
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        if (avatarObjectUrl.current === objectUrl) avatarObjectUrl.current = null;
      }
    };
  }, [user?.avatar, replaceAvatarUrl]);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (!avatarPreviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const avatarTrigger = avatarButton.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAvatarPreviewOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    avatarPreviewCloseButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      avatarTrigger?.focus();
    };
  }, [avatarPreviewOpen]);

  useEffect(() => {
    if (!logoutConfirmOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSigningOut) setLogoutConfirmOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [logoutConfirmOpen, isSigningOut]);

  async function handleLogout() {
    setLogoutConfirmOpen(false);
    setIsSigningOut(true);
    await logout();
    router.replace('/login');
  }

  async function handleAvatarChange(file?: File) {
    if (!file || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify.error('Choose a JPG, PNG or WebP image.');
      return;
    }
    setAvatarBusy(true);
    let temporaryUrl: string | null = null;
    try {
      temporaryUrl = URL.createObjectURL(file);
      const image = new window.Image();
      image.src = temporaryUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('This image could not be opened.'));
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let blob: Blob | null = null;
      while (quality >= 0.42) {
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (blob && blob.size <= 65_536) break;
        quality -= 0.1;
      }
      if (!blob || blob.size > 65_536) throw new Error('Choose a smaller or simpler image (maximum 64 KB after compression).');
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this image.'));
        reader.onerror = () => reject(new Error('Could not read this image.'));
        reader.readAsDataURL(blob as Blob);
      });
      const result = await authAPI.updateAvatar(avatar);
      updateUser({ ...user, avatar: result.avatar });
      setAccountMenuOpen(false);
      notify.success('Profile photo updated.');
    } catch (error) {
      notify.error(getApiError(error, error instanceof Error ? error.message : 'Could not update your profile photo.'));
    } finally {
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      setAvatarBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (!user || !user.avatar) return;
    setAvatarBusy(true);
    try {
      await authAPI.updateAvatar('');
      updateUser({ ...user, avatar: null });
      replaceAvatarUrl(null);
      setAccountMenuOpen(false);
      notify.success('Profile photo removed.');
    } catch (error) {
      notify.error(getApiError(error, 'Could not remove your profile photo.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  if (status !== 'authenticated' || !user) {
    return <AuthLoadingOverlay message="Verifying your secure session…" />;
  }

  const has = (...keys: string[]) => keys.some((key) => user.permissions.includes(key));
  const navItems: Array<{ label: string; href: string; icon: LucideIcon; active: boolean; comingSoon?: boolean }> = [
    ...(has('reports.view') ? [{ label: 'Overview', href: '/dashboard', icon: LayoutDashboard, active: pathname === '/dashboard' }] : []),
    ...(has('sales.view', 'sales.create') ? [{ label: 'Sales', href: has('sales.view') ? '/dashboard/sales/invoices' : '/dashboard/sales/invoices/new', icon: ShoppingCart, active: pathname.startsWith('/dashboard/sales') }] : []),
    ...(has('products.view', 'products.create') ? [{ label: 'Products', href: has('products.view') ? '/dashboard/products' : '/dashboard/products/new', icon: Package, active: pathname.startsWith('/dashboard/products') }] : []),
    ...(has('inventory.view', 'inventory.adjust', 'inventory.transfer') ? [{ label: 'Inventory', href: has('inventory.view') ? '/dashboard/inventory' : has('inventory.adjust') ? '/dashboard/inventory/adjustments/new' : '/dashboard/inventory/transfers/new', icon: Warehouse, active: pathname.startsWith('/dashboard/inventory') }] : []),
    ...(has('purchases.view', 'purchases.create') ? [{ label: 'Purchases', href: has('purchases.view') ? '/dashboard/purchases' : '/dashboard/purchases/orders/new', icon: Truck, active: pathname.startsWith('/dashboard/purchases') }] : []),
    ...(has('customers.view', 'customers.create') ? [{ label: 'Customers', href: has('customers.view') ? '/dashboard/customers' : '/dashboard/customers/new', icon: UsersRound, active: pathname.startsWith('/dashboard/customers') }] : []),
    ...(has('suppliers.view', 'suppliers.create') ? [{ label: 'Suppliers', href: has('suppliers.view') ? '/dashboard/suppliers' : '/dashboard/suppliers/new', icon: UserRound, active: pathname.startsWith('/dashboard/suppliers') }] : []),
    ...(has('payments.view') ? [{ label: 'Payments & Finance', href: '/dashboard/finance', icon: CircleDollarSign, active: pathname.startsWith('/dashboard/finance') && searchParams.get('tab') !== 'periods' }] : []),
    ...(has('settings.view', 'settings.edit') ? [{ label: 'Accounting periods', href: '/dashboard/finance?tab=periods', icon: CalendarDays, active: pathname.startsWith('/dashboard/finance') && searchParams.get('tab') === 'periods' }] : []),
    ...(has('expenses.view', 'expenses.create') ? [{ label: 'Expenses', href: has('expenses.view') ? '/dashboard/expenses' : '/dashboard/expenses/new', icon: Receipt, active: pathname.startsWith('/dashboard/expenses') }] : []),
    ...(has('reports.view') ? [{ label: 'Reports & Analytics', href: '/dashboard/reports', icon: FileBarChart2, active: pathname.startsWith('/dashboard/reports') }] : []),
    ...(has('settings.view', 'settings.edit') ? [{ label: 'Settings', href: '/dashboard/settings', icon: Settings2, active: pathname.startsWith('/dashboard/settings') && !pathname.startsWith('/dashboard/settings/users') && !pathname.startsWith('/dashboard/settings/roles') }] : []),
    ...(has('users.view', 'users.create', 'users.edit', 'users.delete', 'roles.manage') ? [{ label: 'Team access', href: has('users.view', 'users.create', 'users.edit', 'users.delete') ? '/dashboard/settings/users' : '/dashboard/settings/roles', icon: UsersRound, active: pathname.startsWith('/dashboard/settings/users') || pathname.startsWith('/dashboard/settings/roles') }] : []),
    { label: 'Password & security', href: '/dashboard/security', icon: Settings2, active: pathname.startsWith('/dashboard/security') },
    { label: 'Help & feedback', href: '/dashboard/help-feedback', icon: LifeBuoy, active: pathname.startsWith('/dashboard/help-feedback') },
  ];
  const navGroups = [
    { label: 'Workspace', items: navItems.filter(({ label }) => label === 'Overview') },
    { label: 'Operations', items: navItems.filter(({ label }) => ['Sales', 'Products', 'Inventory', 'Purchases', 'Customers', 'Suppliers'].includes(label)) },
    { label: 'Finance', items: navItems.filter(({ label }) => ['Payments & Finance', 'Accounting periods', 'Expenses'].includes(label)) },
    { label: 'Insights', items: navItems.filter(({ label }) => label === 'Reports & Analytics') },
    { label: 'Account', items: navItems.filter(({ label }) => ['Settings', 'Team access', 'Password & security', 'Help & feedback'].includes(label)) },
  ];
  const currentNavItem = navItems.find(({ active }) => active);
  const currentNavGroup = navGroups.find(({ items }) => items.some(({ active }) => active))?.label || 'Workspace';
  const currentNavLabel = pathname.startsWith('/dashboard/notifications') ? 'Notifications' : currentNavItem?.label || 'Business overview';
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase();

  return (
    <div className="min-h-screen min-w-0 bg-[#f5f6f2] lg:flex">
      {mobileMenuOpen ? <button aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] shrink-0 flex-col overflow-hidden border-r border-amber-200/80 bg-amber-50 px-5 py-6 text-[#20231f] shadow-2xl shadow-black/10 transition-all duration-200 dark:border-white/[0.06] dark:bg-[#20211f] dark:text-white dark:shadow-black/20 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:shadow-none lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-[84px] lg:px-3' : 'lg:w-[270px]'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`flex shrink-0 items-center ${compactSidebar ? 'justify-center lg:px-0' : 'justify-between px-2'}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center" aria-label="Mizania dashboard" title="Mizania dashboard">
            {compactSidebar ? <><Image src="/MIZANIA_BRAND_PACKAGE/logos/svg/symbol.svg" alt="Mizania" width={64} height={64} priority className="h-10 w-10 dark:hidden" /><Image src="/MIZANIA_BRAND_PACKAGE/logos/svg/symbol-monochrome-white.svg" alt="Mizania" width={64} height={64} priority className="hidden h-10 w-10 dark:block" /></> : <><Image src="/MIZANIA_BRAND_PACKAGE/logos/svg/wordmark-dark.svg" alt="Mizania — Rekodi, fuatilia, endelea" width={780} height={160} priority className="hidden h-auto w-[180px] dark:block" /><span className="flex min-w-0 items-center gap-2 dark:hidden"><Image src="/MIZANIA_BRAND_PACKAGE/logos/svg/symbol.svg" alt="" width={52} height={52} priority className="h-9 w-9 shrink-0" /><span className="min-w-0"><span className="block truncate text-[15px] font-extrabold tracking-tight text-[#17231e]">Mizania</span><span className="mt-0.5 block truncate text-[6px] font-bold tracking-[0.14em] text-emerald-700">REKODI · FUATILIA · ENDELEA</span></span></span></>}
          </Link>
          <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-[#4f584e] hover:bg-black/[0.04] dark:text-white/60 dark:hover:bg-white/10 lg:hidden"><X size={18} /></button>
        </div>
        <div className="mt-9 shrink-0">
          <button ref={locationButtonRef} type="button" aria-haspopup="dialog" aria-expanded={locationMenuOpen} onClick={toggleLocationMenu} title={compactSidebar ? `${user.businessName || 'Workspace'} · ${activeLocation?.name || 'Choose location'}` : undefined} className={`w-full rounded-xl border border-blue-100 bg-white/75 text-left shadow-sm shadow-blue-950/[0.03] transition hover:border-blue-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-400/50 dark:hover:bg-white/[0.07] dark:focus-visible:outline-blue-400 ${compactSidebar ? 'flex justify-center p-2.5' : 'p-2.5'}`}>
            {compactSidebar ? <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 dark:bg-emerald-500/20 dark:text-emerald-300">{businessBrand?.logoUrl && !workspaceLogoFailed ? <img src={businessBrand.logoUrl} alt={`${businessBrand.name} logo`} onError={() => setWorkspaceLogoFailed(true)} className="h-full w-full object-contain" /> : <Store size={17} />}</span> : <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 dark:bg-emerald-500/20 dark:text-emerald-300">{businessBrand?.logoUrl && !workspaceLogoFailed ? <img src={businessBrand.logoUrl} alt={`${businessBrand.name} logo`} onError={() => setWorkspaceLogoFailed(true)} className="h-full w-full object-contain" /> : <Store size={18} strokeWidth={1.9} />}</span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Workspace</p><p className="mt-0.5 truncate text-sm font-bold text-[#252b23] dark:text-white">{user.businessName || 'Your business'}</p><p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold text-[#465363] dark:text-white/75"><MapPin size={12} className="shrink-0 text-blue-700 dark:text-blue-300" />{locationsLoading ? 'Loading locations…' : activeLocation?.name || 'Choose location'}</p></div><ChevronDown size={15} className={`shrink-0 text-blue-700 transition-transform dark:text-blue-300 ${locationMenuOpen ? 'rotate-180' : ''}`} /></div>}
          </button>
          {locationMenuOpen && typeof document !== 'undefined' && createPortal(<div ref={locationMenuRef} role="dialog" aria-label="Workspace and location" style={{ left: locationMenuPosition.left, top: locationMenuPosition.top }} className="fixed z-[100] max-h-[min(360px,calc(100vh-24px))] w-[min(330px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-blue-100 bg-white p-3 text-[#252b23] shadow-2xl shadow-slate-950/25 dark:border-white/10 dark:bg-[#20211f] dark:text-white">
            <div className="border-b border-slate-100 px-2 pb-3 dark:border-white/10"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">WORKSPACE</p><p className="mt-1 truncate text-sm font-bold">{user.businessName || 'Your business'}</p><p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#515b66] dark:text-white/70"><MapPin size={14} className="text-blue-700 dark:text-blue-300" />Active location</p><p className="mt-1 pl-[21px] text-[10px] leading-4 text-[#66717e] dark:text-white/55">Used for new activity. Dashboard and combined reports show all locations; detail reports have their own filters.</p></div>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {locationsLoading ? <p className="flex items-center gap-2 px-2 py-3 text-xs text-[#59616b] dark:text-white/65"><Loader2 size={14} className="animate-spin" />Loading available locations…</p> : workspaceLocations.length ? workspaceLocations.map((location) => <button key={location.id} type="button" aria-pressed={activeLocation?.id === location.id} onClick={() => { if (location.id === activeLocation?.id) { setPendingLocation(null); setLocationMenuOpen(false); } else setPendingLocation(location); }} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${activeLocation?.id === location.id ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100' : pendingLocation?.id === location.id ? 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-white/[0.06]'}`}><MapPin size={15} className="shrink-0 text-blue-700 dark:text-blue-300" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{location.name}</span><span className="block truncate text-[10px] text-[#66717e] dark:text-white/55">{location.code} · {location.type}</span></span>{activeLocation?.id === location.id && <Check size={16} className="text-green-700 dark:text-green-400" />}</button>) : <p className="px-2 py-3 text-xs leading-5 text-[#59616b] dark:text-white/65">No active locations are available for this account.</p>}
            </div>
            {pendingLocation ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="text-xs leading-5 text-[#344139] dark:text-emerald-100">Switch active location to <span className="font-bold">{pendingLocation.name}</span>? New activity will use this location. Dashboard and combined reports will still show all locations; detail reports have their own filters.</p><div className="mt-2.5 flex justify-end gap-2"><button type="button" onClick={() => setPendingLocation(null)} className="min-h-9 rounded-full px-4 text-xs font-semibold text-[#58635a] transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10">Cancel</button><button type="button" onClick={() => { setActiveLocation(pendingLocation, user.businessId, user.id); setPendingLocation(null); setLocationMenuOpen(false); }} className="min-h-9 rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-900/15 transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">Switch location</button></div></div> : null}
          </div>, document.body)}
        </div>
        <nav aria-label="Main navigation" className="dashboard-sidebar-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-3">
          {navGroups.filter(({ items }) => items.length > 0).map(({ label: groupLabel, items }, groupIndex) => (
            <section key={groupLabel} aria-label={`${groupLabel} navigation`}>
              {compactSidebar ? (
                groupIndex > 0 ? <div aria-hidden="true" className="mx-2 mb-2 border-t border-slate-200 dark:border-[#d8b454]/20" /> : null
              ) : (
                <button
                  type="button"
                  aria-expanded={!collapsedNavGroups[groupLabel]}
                  aria-controls={`sidebar-group-${groupLabel.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setCollapsedNavGroups((groups) => ({ ...groups, [groupLabel]: !groups[groupLabel] }))}
                  className={`mb-1.5 flex min-h-8 w-full items-center justify-between rounded-lg px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 transition hover:bg-blue-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:bg-blue-950/30 dark:focus-visible:outline-blue-400 ${groupIndex === 0 ? 'mt-1' : ''}`}
                >
                  <span>{groupLabel}</span>
                  <ChevronDown size={13} aria-hidden="true" className={`transition-transform ${collapsedNavGroups[groupLabel] ? '-rotate-90' : ''}`} />
                </button>
              )}
              <div id={`sidebar-group-${groupLabel.toLowerCase().replace(/\s+/g, '-')}`} className={`space-y-1 ${!compactSidebar && collapsedNavGroups[groupLabel] ? 'hidden' : ''}`}>
                {items.map(({ label, href, icon: Icon, active, comingSoon }) => (
                  comingSoon ? (
                    <button key={label} type="button" disabled aria-label={`${label} is not available yet`} title={`${label} is coming soon and is not available yet.`} className={`flex min-h-10 w-full cursor-not-allowed items-center rounded-xl py-2.5 text-left text-sm text-[#5f675d] dark:text-white/65 ${compactSidebar ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                      <Icon size={17} strokeWidth={1.8} />{!compactSidebar ? <>{label}<span className="ml-auto rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#62685f] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">Soon</span></> : null}
                    </button>
                  ) : (
                    <Link key={label} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? 'page' : undefined} aria-label={compactSidebar ? label : undefined} title={compactSidebar ? label : undefined} className={`relative flex min-h-10 items-center rounded-xl py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 ${compactSidebar ? 'justify-center px-0' : 'gap-3 px-3'} ${active ? "bg-blue-200 font-semibold text-blue-950 shadow-sm shadow-blue-900/[0.08] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-blue-700 before:content-[''] dark:bg-[#263b69] dark:text-[#e1ebff] dark:shadow-white/[0.05] dark:before:bg-[#7da9ff]" : 'text-[#3f4940] hover:bg-black/[0.03] hover:text-[#20231f] dark:text-white/75 dark:hover:bg-white/[0.07] dark:hover:text-white'}`}>
                      <Icon size={17} strokeWidth={1.8} />{!compactSidebar ? label : null}
                    </Link>
                  )
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="mx-auto min-w-0 w-full max-w-[1500px] flex-1">
        <header className="sticky top-3 z-20 mx-2 mt-2 flex h-[60px] min-w-0 items-center justify-between gap-1.5 rounded-xl border border-white/70 bg-white/75 px-2.5 shadow-[0_8px_28px_rgba(24,31,44,0.12)] backdrop-blur-xl min-[390px]:mx-3 min-[390px]:mt-3 min-[390px]:h-[64px] min-[390px]:px-3 sm:mx-7 sm:gap-2 sm:px-5 lg:mx-10 dark:border-white/10 dark:bg-[#20211f]/70 dark:shadow-[0_8px_28px_rgba(0,0,0,0.28)]">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => isDesktop ? toggleSidebar() : setMobileMenuOpen(true)} aria-label={isDesktop ? sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar' : 'Open navigation'} title={isDesktop ? sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar' : 'Open navigation'} className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-transparent text-[#4f544c] transition hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9dbb16] dark:bg-transparent dark:text-white/80 dark:hover:bg-transparent"><Menu size={19} /></button>
            <div className="min-w-0"><p className="truncate text-xs font-medium text-[#687368] dark:text-white/55">{pathname.startsWith('/dashboard/notifications') ? 'Workspace' : currentNavGroup}</p><p className="mt-0.5 truncate text-sm font-semibold text-[#20231f] dark:text-white">{currentNavLabel}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-1 min-[390px]:gap-1.5 sm:gap-5">
            <ThemeToggle />
            <NotificationBadge />
            <div className="hidden h-8 w-px bg-[#e8e9e5] sm:block" />
            <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountMenuOpen(false); }}>
              <button ref={avatarButton} type="button" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-[#f4f6ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9dbb16]">
                {avatarUrl ? <Image src={avatarUrl} alt="Profile" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e4f28a] text-xs font-bold text-[#354400]">{initials}</span>}
                <span className="hidden min-w-0 sm:block"><span className="block max-w-40 truncate text-xs font-semibold text-[#30342e]">{user.name || `${user.firstName} ${user.lastName}`}</span><span className="mt-0.5 block max-w-40 truncate text-[10px] text-[#73766f]">{user.roles?.[0] || 'Team member'}</span></span>
                <ChevronDown size={14} className={`hidden text-[#596b05] transition sm:block ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose profile photo" onChange={(event) => void handleAvatarChange(event.target.files?.[0])} />
              {accountMenuOpen ? <div role="menu" aria-label="Account options" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-[#e2e7d3] bg-white p-1.5 shadow-xl shadow-black/10">
                {avatarUrl ? <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setAvatarPreviewOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#30342e] transition hover:bg-[#f0f7c9] hover:text-[#354400]"><Eye size={16} className="text-[#70820f]" />View profile photo</button> : null}
                <button type="button" role="menuitem" disabled={avatarBusy} onClick={() => photoInput.current?.click()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#30342e] transition hover:bg-[#f0f7c9] hover:text-[#354400] disabled:opacity-60">{avatarBusy ? <Loader2 size={16} className="animate-spin text-[#70820f]" /> : <ImagePlus size={16} className="text-[#70820f]" />}{avatarBusy ? 'Saving photo…' : avatarUrl ? 'Change profile photo' : 'Add profile photo'}</button>
                {avatarUrl ? <button type="button" role="menuitem" disabled={avatarBusy} onClick={() => void handleRemoveAvatar()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#a63832] transition hover:bg-[#fff0ed] disabled:opacity-60"><Trash2 size={16} />Remove profile photo</button> : null}
                <Link href="/dashboard/security" role="menuitem" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#30342e] transition hover:bg-[#f0f7c9] hover:text-[#354400]"><Settings2 size={16} className="text-[#70820f]" />Change password</Link>
              </div> : null}
            </div>
            <button type="button" onClick={() => { setAccountMenuOpen(false); setLogoutConfirmOpen(true); }} disabled={isSigningOut} aria-label={isSigningOut ? 'Signing out' : 'Sign out'} className="flex items-center gap-2 rounded-full border border-[#e8e9e5] bg-[#fcfcfb] px-2.5 py-2 text-xs font-semibold text-[#545850] transition hover:border-[#cbd0c6] hover:bg-[#f8f9f6] disabled:opacity-60 sm:px-3 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80 dark:hover:border-white/20 dark:hover:bg-white/[0.08]"><LogOut size={15} /><span className="hidden md:inline">{isSigningOut ? 'Signing out' : 'Sign out'}</span></button>
          </div>
        </header>
        <main className="w-full min-w-0 p-2 min-[390px]:p-3 sm:p-5 lg:p-10">{children}</main>
      </div>
      {avatarPreviewOpen && avatarUrl ? <div role="dialog" aria-modal="true" aria-labelledby="avatar-preview-title" aria-describedby="avatar-preview-description" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10120f]/75 p-3 backdrop-blur-md sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) setAvatarPreviewOpen(false); }}>
        <div className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#e8eadf] bg-white text-[#20211f] shadow-[0_28px_100px_rgba(0,0,0,0.38)] dark:border-white/10 dark:bg-[#191d1a] dark:text-white sm:rounded-[30px]">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f2f6d9] text-[#53630b] dark:bg-[#38331d] dark:text-[#e5d17c]"><UserRound size={20} /></span>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#687b0d] dark:text-[#d8c36a]">Profile photo</p><h2 id="avatar-preview-title" className="mt-0.5 truncate text-base font-semibold sm:text-lg">{user.name || `${user.firstName} ${user.lastName}`}</h2><p id="avatar-preview-description" className="mt-0.5 text-xs text-[#777c71] dark:text-[#aeb4aa]">Account profile image</p></div>
            </div>
            <button ref={avatarPreviewCloseButton} type="button" aria-label="Close profile photo preview" onClick={() => setAvatarPreviewOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#e6e8df] bg-[#f7f8f3] text-[#42473e] transition hover:border-[#cad39b] hover:bg-[#eef3d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#91a719] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/85 dark:hover:border-white/20 dark:hover:bg-white/[0.12]"><X size={18} /></button>
          </div>
          <div className="mx-3 mb-3 grid h-[min(70vh,760px)] min-h-60 place-items-center overflow-hidden rounded-[20px] border border-[#e9ebdf] bg-[radial-gradient(circle_at_50%_42%,rgba(176,193,74,0.13),transparent_62%),linear-gradient(145deg,#f5f6f0,#ecefe6)] p-3 sm:mx-5 sm:mb-5 sm:rounded-[26px] sm:p-6 dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_50%_42%,rgba(181,158,71,0.12),transparent_62%),linear-gradient(145deg,#111512,#171c18)]">
            <Image src={avatarUrl} alt={`Profile photo of ${user.name || `${user.firstName} ${user.lastName}`}`} width={1200} height={1200} unoptimized className="h-full w-full rounded-xl object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.22)] sm:rounded-2xl" />
          </div>
        </div>
      </div> : null}
      {logoutConfirmOpen ? <div role="presentation" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutConfirmOpen(false); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description" className="w-full max-w-sm rounded-2xl border border-[#e5e7e0] bg-white p-5 text-[#20211f] shadow-2xl dark:border-[#343b33] dark:bg-[#171a17] dark:text-[#f0f1ed]">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7f4ed] text-[#16734a] dark:bg-[#173426] dark:text-[#77ddb0]"><LogOut size={19} /></span><div><h2 id="logout-confirm-title" className="text-base font-semibold">Sign out?</h2><p id="logout-confirm-description" className="mt-1 text-sm leading-5 text-[#62685d] dark:text-[#afb5ac]">Are you sure you want to sign out of your account?</p></div></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setLogoutConfirmOpen(false)} className="min-h-10 rounded-xl border border-[#dfe2da] px-4 text-sm font-semibold text-[#454a42] transition hover:bg-[#f5f6f2] dark:border-[#41473f] dark:text-[#e1e4dc] dark:hover:bg-[#222622]">Cancel</button><button type="button" onClick={() => void handleLogout()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#a63832] px-4 text-sm font-semibold text-white transition hover:bg-[#8f2d28] disabled:opacity-60 dark:bg-[#8f302b] dark:hover:bg-[#a63832]"><LogOut size={15} />{isSigningOut ? 'Signing out…' : 'Yes, sign out'}</button></div>
        </section>
      </div> : null}
      <RouteTransitionOverlay />
      <SessionTimeoutGuard />
    </div>
  );
}
