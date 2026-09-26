import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings } from './db';
import { subscribeAuth, logoutUser, AuthUser } from './services/firebase';
import { Header } from './components/Header';
import { CalendarDashboard } from './components/CalendarDashboard';
import { MeetingsHistoryView } from './components/MeetingsHistoryView';
import { MeetingDetail } from './components/MeetingDetail';
import { ResourcesView } from './components/ResourcesView';
import { TasksView } from './components/TasksView';
import { DelegateView } from './components/DelegateView';
import { LoginView } from './components/LoginView';
import { SettingsModal } from './components/SettingsModal';
import { AddExistingMeetingModal } from './components/AddExistingMeetingModal';
import { DiagnosticPanelModal } from './components/DiagnosticPanelModal';
import { FloatingChatbot } from './components/FloatingChatbot';
import { Meeting, CalendarEvent } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate'>('calendar');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [addMeetingInitialDate, setAddMeetingInitialDate] = useState<string | undefined>(undefined);

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

  const handleOpenAddMeeting = (initialDate?: string) => {
    setAddMeetingInitialDate(initialDate);
    setIsAddMeetingOpen(true);
  };

  const [chatbotResource, setChatbotResource] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-zinc-800 flex flex-col font-sans selection:bg-zinc-200 selection:text-zinc-900">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedMeetingId(null);
          setChatbotResource(undefined);
        }}
        currentUser={currentUser}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onSignOut={() => logoutUser()}
        onOpenLogin={() => setCurrentUser(null)}
        onSelectMeeting={(id) => setSelectedMeetingId(id)}
      />

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

      {/* Global Floating Chatbot for Instant Meeting Intelligence & Memory Queries */}
      <FloatingChatbot
        userId={userId}
        currentContext={{
          tab: activeTab,
          meetingTitle: selectedMeeting?.title,
          meetingId: selectedMeeting?.id,
          resourceTitle: chatbotResource,
        }}
      />

      {/* Settings & Privacy Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onReloadData={() => setSelectedMeetingId(null)}
      />

      {/* Diagnostic & Health Modal */}
      <DiagnosticPanelModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        userId={userId}
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
