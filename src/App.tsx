import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings } from './db';
import { subscribeAuth, logoutUser, AuthUser } from './services/firebase';
import { populateDemoData } from './db/demoData';
import { Sidebar } from './components/Sidebar';
import { CalendarDashboard } from './components/CalendarDashboard';
import { MeetingsHistoryView } from './components/MeetingsHistoryView';
import { MeetingDetail } from './components/MeetingDetail';
import { ResourcesView } from './components/ResourcesView';
import { TasksView } from './components/TasksView';
import { DelegateView } from './components/DelegateView';
import { LoginView } from './components/LoginView';
import { DemoTourModal } from './components/DemoTourModal';
import { SettingsModal } from './components/SettingsModal';
import { AddExistingMeetingModal } from './components/AddExistingMeetingModal';
import { FloatingChatbot } from './components/FloatingChatbot';
import { Meeting, CalendarEvent } from './types';
import { Menu } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate'>('calendar');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  // Modals & Tour
  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [addMeetingInitialDate, setAddMeetingInitialDate] = useState<string | undefined>(undefined);
  const [chatbotResource, setChatbotResource] = useState<string | undefined>(undefined);

  const userId = currentUser?.uid || '';

  // Live Database Queries — FILTERED STRICTLY BY CURRENT USER
  const meetings = useLiveQuery<Meeting[]>(
    () => (userId ? db.meetings.where('userId').equals(userId).reverse().sortBy('date') : Promise.resolve<Meeting[]>([])),
    [userId]
  ) || [];

  const calendarEvents = useLiveQuery<CalendarEvent[]>(
    () => (userId ? db.calendarEvents.where('userId').equals(userId).toArray() : Promise.resolve<CalendarEvent[]>([])),
    [userId]
  ) || [];

  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      setCurrentUser(user);
      setAuthChecked(true);
      if (user) {
        ensureSettings(user.uid);
      }
    });

    // Clean startup — no mock data preloaded
    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (authChecked && !currentUser) {
    return (
      <LoginView
        onSuccess={(u) => {
          setCurrentUser(u);
          ensureSettings(u.uid);
        }}
      />
    );
  }

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  const handleUpdateMeeting = (updated: Meeting) => {
    // LiveQuery will automatically update the state
  };

  const handleLoadDemoData = async () => {
    if (!userId) return;
    await populateDemoData(userId);
  };

  const handleClearDemoData = async () => {
    if (!userId) return;
    await db.transaction('rw', [
      db.meetings, db.transcripts, db.decisions, db.commitments,
      db.tasks, db.people, db.calendarEvents, db.resources,
      db.memories, db.delegateSessions,
    ], async () => {
      await db.meetings.where('userId').equals(userId).delete();
      await db.transcripts.where('userId').equals(userId).delete();
      await db.decisions.where('userId').equals(userId).delete();
      await db.commitments.where('userId').equals(userId).delete();
      await db.tasks.where('userId').equals(userId).delete();
      await db.calendarEvents.where('userId').equals(userId).delete();
      await db.resources.where('userId').equals(userId).delete();
      await db.memories.where('userId').equals(userId).delete();
      await db.delegateSessions.where('userId').equals(userId).delete();
    });
    setSelectedMeetingId(null);
  };

  const handleOpenAddMeeting = (initialDate?: string) => {
    setAddMeetingInitialDate(initialDate);
    setIsAddMeetingOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-black flex font-sans selection:bg-black selection:text-white">
      {/* Left Vertical Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedMeetingId(null);
          setChatbotResource(undefined);
        }}
        currentUser={currentUser}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartDemoTour={() => setIsDemoTourOpen(true)}
        onSignOut={() => logoutUser()}
        onOpenLogin={() => setCurrentUser(null)}
        onLoadDemoData={handleLoadDemoData}
        onClearDemoData={handleClearDemoData}
        onSelectMeeting={(id) => setSelectedMeetingId(id)}
        onOpenAddMeeting={() => handleOpenAddMeeting()}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area (offset by collapsed sidebar width on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-[68px]">
        {/* Mobile Top Bar (only visible on small screens < md) */}
        <div className="md:hidden h-14 bg-white border-b border-zinc-200 px-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src="/logo.png" alt="MeetingMind" className="w-6 h-6 rounded-md object-cover shadow-2xs" />
            <span className="font-semibold text-zinc-900 text-sm">MeetingMind</span>
          </div>
          <span className="text-xs font-medium text-zinc-500 capitalize">{activeTab}</span>
        </div>

        {/* Main App Workspace */}
        <main className="flex-1 pb-16">
          {selectedMeeting ? (
            <MeetingDetail
              meeting={selectedMeeting}
              onBack={() => setSelectedMeetingId(null)}
              onUpdate={handleUpdateMeeting}
            />
          ) : (
            <>
              {activeTab === 'calendar' && (
                <CalendarDashboard
                  meetings={meetings}
                  calendarEvents={calendarEvents}
                  onSelectMeeting={(id) => setSelectedMeetingId(id)}
                  onAddExistingMeeting={handleOpenAddMeeting}
                />
              )}

              {activeTab === 'meetings' && (
                <MeetingsHistoryView
                  meetings={meetings}
                  onSelectMeeting={(id) => setSelectedMeetingId(id)}
                  onAddMeeting={() => handleOpenAddMeeting()}
                />
              )}

              {activeTab === 'resources' && (
                <ResourcesView
                  userId={userId}
                  onAskAboutResource={(title) => setChatbotResource(title)}
                />
              )}

              {activeTab === 'tasks' && (
                <TasksView
                  userId={userId}
                  onSelectMeeting={(id) => setSelectedMeetingId(id)}
                />
              )}

              {activeTab === 'delegate' && (
                <DelegateView
                  userId={userId}
                  onSelectMeeting={(id) => setSelectedMeetingId(id)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Floating Chatbot for Instant Meeting Intelligence & Memory Queries */}
      <FloatingChatbot
        currentContext={{
          tab: activeTab,
          meetingTitle: selectedMeeting?.title,
          meetingId: selectedMeeting?.id,
          resourceTitle: chatbotResource,
        }}
      />

      {/* Interactive Guided Demo Tour Overlay */}
      <DemoTourModal
        isOpen={isDemoTourOpen}
        onClose={() => setIsDemoTourOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setSelectedMeetingId(null);
        }}
        onSelectMeeting={(id) => setSelectedMeetingId(id)}
      />

      {/* Settings & Privacy Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onReloadData={() => setSelectedMeetingId(null)}
      />

      {/* Add Existing External Meeting Modal */}
      <AddExistingMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
        onAdded={(id) => {
          setSelectedMeetingId(id);
          setIsAddMeetingOpen(false);
        }}
        userId={userId}
        initialDate={addMeetingInitialDate}
      />
    </div>
  );
}

export default App;
