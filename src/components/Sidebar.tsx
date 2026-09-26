import React, { useState, useRef, useEffect } from 'react';
import {
  CalendarDays,
  Video,
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
  Loader2,
  ChevronsUpDown,
  X,
  Pin,
  PinOff,
} from 'lucide-react';
import { AuthUser } from '../services/firebase';
import { processingQueue, ProcessingJob } from '../services/processingPipeline';

export interface SidebarProps {
  activeTab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate';
  setActiveTab: (tab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate') => void;
  currentUser: AuthUser | null;
  onOpenSettings: () => void;
  onStartDemoTour: () => void;
  onSignOut: () => void;
  onOpenLogin: () => void;
  onLoadDemoData?: () => void;
  onClearDemoData?: () => void;
  onSelectMeeting?: (meetingId: string) => void;
  onOpenAddMeeting?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenSettings,
  onStartDemoTour,
  onSignOut,
  onOpenLogin,
  onLoadDemoData,
  onClearDemoData,
  onSelectMeeting,
  onOpenAddMeeting,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expanded if mouse is over, or pinned open, or open on mobile
  const isExpanded = isHovered || isPinned || isMobileOpen;

  useEffect(() => {
    const unsub = processingQueue.subscribe((jobs) => {
      setActiveJobs(jobs.filter((j) => j.status !== 'completed' && j.status !== 'error'));
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      if (!isPinned) {
        setIsUserMenuOpen(false);
      }
    }, 80);
  };

  const navItems = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'meetings', label: 'Meetings', icon: Video },
    { id: 'resources', label: 'Resources', icon: Folder },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'delegate', label: 'Delegate', icon: UserRoundCheck },
  ] as const;

  const handleNavClick = (tab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate') => {
    setActiveTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const userInitial = currentUser?.displayName
    ? currentUser.displayName.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Vertical Animated Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed top-0 bottom-0 left-0 bg-white z-50 flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] font-sans ${
          isExpanded
            ? 'w-64 shadow-2xl border-r border-zinc-200/90'
            : 'w-[68px] border-r border-zinc-200/80 shadow-none'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Top Header & Navigation Area */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {/* Brand Logo & Title */}
          <div className="h-14 px-3.5 flex items-center justify-between border-b border-zinc-100 shrink-0">
            <button
              onClick={() => handleNavClick('calendar')}
              className="flex items-center text-zinc-900 hover:opacity-85 transition-opacity text-left overflow-hidden"
              title="MeetingMind"
            >
              <img
                src="/logo.png"
                alt="MeetingMind"
                className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-2xs"
              />
              <div
                className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
                  isExpanded ? 'opacity-100 max-w-[160px] ml-2.5' : 'opacity-0 max-w-0 ml-0 pointer-events-none'
                }`}
              >
                <span className="font-semibold text-base tracking-tight text-zinc-900 block leading-tight font-sans">
                  MeetingMind
                </span>
                <span className="text-[10px] text-zinc-400 font-medium block">
                  AI Meeting Delegate
                </span>
              </div>
            </button>

            {/* Desktop Pin/Unpin Toggle (visible when expanded) */}
            {isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPinned(!isPinned);
                }}
                className={`p-1.5 rounded-md transition-colors hidden md:flex items-center justify-center shrink-0 ${
                  isPinned
                    ? 'text-zinc-900 bg-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title={isPinned ? 'Unpin sidebar (auto-collapse when cursor leaves)' : 'Pin sidebar open'}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 md:hidden shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Action: Add Meeting */}
          {onOpenAddMeeting && (
            <div className="p-3 shrink-0">
              <button
                onClick={() => {
                  onOpenAddMeeting();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-2xs transition-colors group overflow-hidden"
                title="Add Existing Meeting"
              >
                {/* Fixed 36px icon container with permanent w-4 h-4 icon */}
                <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span
                  className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'opacity-100 max-w-[150px] pr-2' : 'opacity-0 max-w-0 pr-0 pointer-events-none'
                  }`}
                >
                  Add Existing Meeting
                </span>
              </button>
            </div>
          )}

          {/* Vertical Navigation Options */}
          <div className="px-3 py-1 flex-1">
            <div
              className={`px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold transition-all duration-300 ${
                isExpanded ? 'opacity-100 max-h-6' : 'opacity-0 max-h-0 overflow-hidden pb-0'
              }`}
            >
              Workspace
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={!isExpanded ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors p-1.5 text-left group overflow-hidden ${
                      isActive
                        ? 'bg-black text-white font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    {/* Fixed 36px icon container with permanent w-4 h-4 icon */}
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-zinc-500 group-hover:text-black'
                        }`}
                      />
                    </div>
                    {/* Text smoothly collapses width and fades out */}
                    <span
                      className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? 'opacity-100 max-w-[140px] ml-2' : 'opacity-0 max-w-0 ml-0 pointer-events-none'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Background Processing Indicator */}
          {activeJobs.length > 0 && (
            <div className="p-3 border-t border-zinc-100 shrink-0">
              {isExpanded ? (
                <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-xs">
                  <div className="flex items-center gap-1.5 text-black font-semibold mb-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black shrink-0" />
                    <span>Processing ({activeJobs.length})</span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {activeJobs.map((job) => (
                      <div
                        key={job.meetingId}
                        onClick={() => {
                          onSelectMeeting?.(job.meetingId);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className="cursor-pointer bg-white hover:bg-zinc-50 p-1.5 rounded border border-zinc-300 transition-colors"
                      >
                        <div className="font-medium text-black truncate text-[11px]">
                          {job.meetingTitle}
                        </div>
                        <div className="text-[10px] text-zinc-600 font-mono">{job.step}</div>
                        <div className="w-full bg-zinc-200 h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-black h-1 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="w-9 h-9 mx-auto rounded-xl bg-zinc-100 border border-zinc-300 text-black flex items-center justify-center cursor-pointer shadow-2xs"
                  title={`Processing ${activeJobs.length} item(s)`}
                >
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile in the Left Side Down Corner */}
        <div className="p-3 border-t border-zinc-200/80 relative shrink-0" ref={userMenuRef}>
          {/* User Profile Dropdown Popup Menu */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-2 mb-2 w-60 bg-white border border-zinc-200 rounded-xl shadow-xl py-1 text-xs text-zinc-700 z-50 animate-in fade-in-50 duration-100 font-sans">
              <div className="px-3 py-2 border-b border-zinc-100">
                <p className="font-semibold text-zinc-900 truncate">
                  {currentUser?.displayName || 'User'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate font-mono">
                  {currentUser?.email || ''}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700 transition-colors"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Settings & Privacy</span>
              </button>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onStartDemoTour();
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700 transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Interactive Demo Tour</span>
              </button>

              <div className="border-t border-zinc-100 my-1" />

              <div className="px-3 py-1 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Developer / Demo
              </div>

              {onLoadDemoData && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLoadDemoData();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Load Demo Data</span>
                </button>
              )}

              {onClearDemoData && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (window.confirm('Clear all your local data? This cannot be undone.')) {
                      onClearDemoData();
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center gap-2 text-black transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Clear All Data</span>
                </button>
              )}

              <div className="border-t border-zinc-100 my-1" />

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onSignOut();
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center gap-2 text-black transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          )}

          {/* Profile Trigger Button in Left Down Corner */}
          {currentUser ? (
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center p-1.5 rounded-xl hover:bg-zinc-100 transition-colors text-left group border border-transparent hover:border-zinc-200/60 overflow-hidden"
              title={currentUser.displayName || currentUser.email || 'User Profile'}
            >
              {/* Permanent w-9 h-9 Avatar - NEVER changes size or jumps */}
              <div className="w-9 h-9 rounded-full bg-zinc-900 text-zinc-100 flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
                {userInitial}
              </div>
              <div
                className={`flex-1 min-w-0 transition-all duration-300 ease-in-out overflow-hidden ${
                  isExpanded ? 'opacity-100 max-w-[140px] ml-2.5' : 'opacity-0 max-w-0 ml-0 pointer-events-none'
                }`}
              >
                <div className="text-xs font-semibold text-zinc-900 truncate">
                  {currentUser.displayName || 'User'}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono truncate">
                  {currentUser.email || 'Logged in'}
                </div>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
                  isExpanded ? 'opacity-100 max-w-[20px] ml-1' : 'opacity-0 max-w-0 ml-0 pointer-events-none'
                }`}
              >
                <ChevronsUpDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600" />
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="w-full flex items-center p-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors overflow-hidden"
              title="Sign in"
            >
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'opacity-100 max-w-[120px] ml-2' : 'opacity-0 max-w-0 ml-0 pointer-events-none'
                }`}
              >
                Sign in
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
