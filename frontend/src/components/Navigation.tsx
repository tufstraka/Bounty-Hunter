'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3 } from '@/contexts/Web3Context';
import WalletConnect from '@/components/WalletConnect';
import { 
  Menu, X, LogOut, Settings, Shield, Sparkles, 
  FolderKanban, LayoutDashboard, Zap, Play, Eye, 
  Hexagon, ChevronDown, Wallet
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

export function Navigation() {
  const { user, loading, login, logout, isDemo, exitDemoMode } = useAuth();
  const { isBlockchainMode } = useWeb3();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-menu') && !target.closest('.profile-button')) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const isActive = useCallback((path: string) => pathname === path, [pathname]);

  // Navigation links configuration
  const navLinks = [
    { href: '/bounties', label: 'Explore', icon: Sparkles, public: true },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, public: false },
    { href: '/projects', label: 'Projects', icon: FolderKanban, public: false },
  ];

  const NavLink = ({ href, children, icon: Icon }: { href: string; children: React.ReactNode; icon?: React.ElementType }) => (
    <Link 
      href={href} 
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium 
        transition-all duration-200
        ${isActive(href)
          ? 'text-primary-700 bg-primary-50'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
    >
      {Icon && (
        <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110
          ${isActive(href) ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
        />
      )}
      <span>{children}</span>
      {/* Active indicator */}
      {isActive(href) && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 
          rounded-full bg-primary-500" />
      )}
    </Link>
  );

  return (
    <>
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-gradient-to-r from-secondary-600 to-secondary-500 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="font-semibold">Demo Mode</span>
            </div>
            <span className="hidden sm:inline opacity-80">— Exploring with sample data</span>
            <button
              onClick={exitDemoMode}
              className="ml-2 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 
                transition-colors duration-200 font-medium text-xs uppercase tracking-wide"
            >
              Exit Demo
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <header 
        className={`sticky top-0 z-50 transition-all duration-300
          ${scrolled 
            ? 'bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-sm' 
            : 'bg-transparent'
          }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 
                    flex items-center justify-center shadow-primary
                    transition-transform duration-300 group-hover:scale-105">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  {/* Activity indicator */}
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-secondary-500 
                    rounded-full border-2 border-white shadow-sm" />
                </div>
                <div className="hidden sm:flex items-baseline">
                  <span className="text-lg font-bold text-gray-900 tracking-tight">Fix</span>
                  <span className="text-lg font-bold text-gradient-primary tracking-tight">Flow</span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => (
                  (link.public || user) && (
                    <NavLink key={link.href} href={link.href} icon={link.icon}>
                      {link.label}
                    </NavLink>
                  )
                ))}
                {user?.role === 'admin' && (
                  <NavLink href="/admin" icon={Shield}>
                    Admin
                  </NavLink>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {/* Blockchain Mode Badge */}
              {isBlockchainMode && (
                <div className="hidden md:flex items-center gap-2">
                  <WalletConnect variant="compact" />
                </div>
              )}

              {/* User Section */}
              {loading ? (
                <div className="w-9 h-9 rounded-xl skeleton" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="profile-button flex items-center gap-2 p-1 pr-2 rounded-xl
                      bg-gray-50 hover:bg-gray-100 border border-gray-200
                      transition-all duration-200 group"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                  >
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded-lg ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 
                        flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {user.githubLogin[0].toUpperCase()}
                      </div>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200
                      ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Profile Dropdown */}
                  {profileOpen && (
                    <div className="profile-menu absolute right-0 mt-2 w-72 
                      bg-white rounded-2xl border border-gray-200 shadow-xl
                      overflow-hidden animate-scale-in origin-top-right">
                      {/* User Header */}
                      <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt=""
                              width={44}
                              height={44}
                              className="rounded-xl ring-2 ring-white shadow-md"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 
                              flex items-center justify-center text-white text-lg font-bold shadow-md">
                              {user.githubLogin[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {user.name || user.githubLogin}
                            </p>
                            <p className="text-sm text-gray-500 truncate">@{user.githubLogin}</p>
                          </div>
                        </div>
                        
                        {/* Role/Demo badges */}
                        <div className="mt-3 flex items-center gap-2">
                          {isDemo ? (
                            <span className="badge-secondary">
                              <Play className="w-3 h-3" />
                              Demo {user.role === 'admin' ? '(Admin)' : ''}
                            </span>
                          ) : user.role === 'admin' && (
                            <span className="badge-accent">
                              <Shield className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                            text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setProfileOpen(false)}
                        >
                          <LayoutDashboard className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Dashboard</span>
                        </Link>
                        <Link
                          href="/settings"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                            text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setProfileOpen(false)}
                        >
                          <Settings className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Settings</span>
                        </Link>
                        {isBlockchainMode && (
                          <Link
                            href="/settings"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                              text-gray-700 hover:bg-gray-100 transition-colors"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Wallet className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">Wallet</span>
                          </Link>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="p-2 border-t border-gray-100">
                        {isDemo ? (
                          <button
                            onClick={() => {
                              exitDemoMode();
                              setProfileOpen(false);
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                              text-secondary-600 hover:bg-secondary-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="font-medium">Exit Demo</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              logout();
                              setProfileOpen(false);
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                              text-error-600 hover:bg-error-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="font-medium">Sign Out</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={login}
                  className="btn-primary group"
                >
                  <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" 
                    fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span className="hidden sm:inline">Get Started</span>
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <X className="w-5 h-5 text-gray-600" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 
            bg-white border-b border-gray-200 shadow-lg
            animate-fade-in-down">
            <nav className="max-w-7xl mx-auto p-4 space-y-1">
              {/* Blockchain Mode for Mobile */}
              {isBlockchainMode && (
                <div className="mb-4 p-4 rounded-2xl bg-accent-50 border border-accent-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Hexagon className="w-5 h-5 text-accent-600" />
                      <span className="font-semibold text-accent-700">Blockchain Mode</span>
                    </div>
                    <span className="badge-secondary text-xs">Active</span>
                  </div>
                  <WalletConnect variant="full" />
                </div>
              )}

              {/* Navigation Links */}
              {navLinks.map((link) => (
                (link.public || user) && (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium 
                      transition-colors duration-200
                      ${isActive(link.href)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <link.icon className={`w-5 h-5 
                      ${isActive(link.href) ? 'text-primary-600' : 'text-gray-400'}`} />
                    {link.label}
                  </Link>
                )
              ))}

              {user?.role === 'admin' && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <Link
                    href="/admin"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium 
                      transition-colors duration-200
                      ${isActive('/admin')
                        ? 'bg-accent-50 text-accent-700'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Shield className={`w-5 h-5 
                      ${isActive('/admin') ? 'text-accent-600' : 'text-gray-400'}`} />
                    Admin
                  </Link>
                </>
              )}

              {user && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium 
                      transition-colors duration-200
                      ${isActive('/settings')
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className={`w-5 h-5 
                      ${isActive('/settings') ? 'text-primary-600' : 'text-gray-400'}`} />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      isDemo ? exitDemoMode() : logout();
                      setMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium 
                      transition-colors duration-200
                      ${isDemo 
                        ? 'text-secondary-600 hover:bg-secondary-50' 
                        : 'text-error-600 hover:bg-error-50'
                      }`}
                  >
                    <LogOut className="w-5 h-5" />
                    {isDemo ? 'Exit Demo' : 'Sign Out'}
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}