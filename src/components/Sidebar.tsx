import React, { useState, useRef, useEffect } from 'react';
import {
  CalendarDays,
  Search,
  Folder,
  CheckSquare,
  UserRoundCheck,
  Plus,
  User,
  LogOut,
  Settings as SettingsIcon,
  Play,
  Database,
  Trash2,
} from 'lucide-react';
import { AuthUser } from '../services/firebase';

interface SidebarProps {
  activeTab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate';
  setActiveTab: (tab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate') => void;
  onOpenAddMeeting: () => void;
  currentUser: AuthUser | null;
  onOpenSettings: () => void;
  onStartDemoTour: () => void;
  onSignOut: () => void;
  onOpenLogin: () => void;
  onLoadDemoData?: () => void;
  onClearDemoData?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddMeeting,
  currentUser,
  onOpenSettings,
  onStartDemoTour,
  onSignOut,
  onOpenLogin,
  onLoadDemoData,
  onClearDemoData,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'meetings', label: 'Meetings', icon: Search },
    { id: 'resources', label: 'Resources', icon: Folder },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'delegate', label: 'AI Delegate', icon: UserRoundCheck },
  ] as const;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[68px] bg-[#121214] text-zinc-400 flex flex-col items-center justify-between py-4 z-40 select-none border-r border-zinc-800">
      {/* Top Group: Brand & Add Meeting Action */}
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Brand Logo */}
        <button
          onClick={() => setActiveTab('calendar')}
          className="w-10 h-10 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-serif text-lg font-bold shadow-sm hover:scale-105 transition-all group relative"
          title="MeetingMind"
        >
          <span>M</span>
          <div className="absolute left-14 px-2 py-1 bg-zinc-900 text-white text-[11px] rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            MeetingMind
          </div>
        </button>

        {/* Add Existing Meeting Action */}
        <button
          onClick={onOpenAddMeeting}
          className="w-10 h-10 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center transition-all group relative"
          title="Add Existing Meeting"
        >
          <Plus className="w-4 h-4" />
          <div className="absolute left-14 px-2 py-1 bg-zinc-900 text-white text-[11px] rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            Add Existing Meeting
          </div>
        </button>

        {/* Divider */}
        <div className="w-8 h-[1px] bg-zinc-800 my-1" />

        {/* Primary Navigation Icons */}
        <nav className="flex flex-col items-center gap-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {/* Tooltip on Hover */}
                <div className="absolute left-14 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-zinc-800">
                  {item.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Group: User Profile Avatar */}
      <div className="relative w-full flex justify-center" ref={menuRef}>
        {currentUser ? (
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center font-medium text-xs border border-zinc-700 hover:border-zinc-500 transition-all group relative"
            title={currentUser.displayName || currentUser.email || 'User Profile'}
          >
            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
            <div className="absolute left-14 px-2.5 py-1 bg-zinc-900 text-white text-[11px] rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-zinc-800">
              {currentUser.displayName || currentUser.email || 'Profile'}
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenLogin}
            className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs hover:bg-zinc-700"
          >
            <User className="w-4 h-4" />
          </button>
        )}

        {/* User Dropdown Menu */}
        {isUserMenuOpen && (
          <div className="absolute left-16 bottom-0 w-56 bg-white text-zinc-800 border border-zinc-200 rounded-lg shadow-xl py-1 text-xs z-50 animate-in fade-in-50 duration-100 font-sans">
            <div className="px-3 py-2 border-b border-zinc-100">
              <p className="font-semibold text-zinc-900 truncate">
                {currentUser?.displayName || 'User'}
              </p>
              <p className="text-[11px] text-zinc-400 truncate font-mono">
                {currentUser?.email || 'Logged in'}
              </p>
            </div>

            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                onStartDemoTour();
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
            >
              <Play className="w-3.5 h-3.5 text-zinc-500" />
              <span>Interactive Demo Tour</span>
            </button>

            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                onOpenSettings();
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-zinc-500" />
              <span>Settings & Privacy</span>
            </button>

            {/* Developer / Demo Data Options */}
            <div className="border-t border-zinc-100 my-1" />
            <div className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-400 font-semibold">
              Evaluation & Demo
            </div>

            {onLoadDemoData && (
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLoadDemoData();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
              >
                <Database className="w-3.5 h-3.5 text-zinc-500" />
                <span>Load Demo Workspace</span>
              </button>
            )}

            {onClearDemoData && (
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  if (window.confirm('Clear all local meetings and records?')) {
                    onClearDemoData();
                  }
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Local Data</span>
              </button>
            )}

            <div className="border-t border-zinc-100 my-1" />

            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                onSignOut();
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-rose-600 hover:text-rose-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
