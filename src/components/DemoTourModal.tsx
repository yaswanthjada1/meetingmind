import React, { useState } from 'react';
import { Sparkles, X, ChevronRight, ChevronLeft, Play, Check } from 'lucide-react';

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate') => void;
  onSelectMeeting?: (meetingId: string) => void;
  onOpenSimulatedDelegate?: () => void;
}

export const TOUR_STEPS = [
  {
    step: 1,
    title: 'Calendar Dashboard',
    description: 'Your meetings are organized in a clean weekly calendar. It immediately answers: "What meetings do I have today and this week?"',
    tab: 'calendar' as const,
    actionText: 'View Calendar',
  },
  {
    step: 2,
    title: 'Focused Meeting Workspace',
    description: 'Clicking any meeting opens a notepad-like document with participants, scratchpad notes, AI insights, and in-context AI chat.',
    tab: 'meetings' as const,
    actionText: 'Open Project Alpha Review',
  },
  {
    step: 3,
    title: 'In-Meeting Recording & Live Notes',
    description: 'Use the browser MediaRecorder API to transcribe meetings locally. No audio leaves your device.',
    tab: 'meetings' as const,
    actionText: 'Inspect Recording Controls',
  },
  {
    step: 4,
    title: 'Meeting Intelligence & Commitments',
    description: 'MeetingMind automatically extracts important points, architectural decisions, deadlines, and commitments with confidence scoring.',
    tab: 'tasks' as const,
    actionText: 'View Tasks & Commitments',
  },
  {
    step: 5,
    title: 'Resources (RAG Knowledge Base)',
    description: 'Upload PDF, DOCX, TXT, or Markdown documents. MeetingMind indexes them locally in IndexedDB to reason over project background.',
    tab: 'resources' as const,
    actionText: 'View RAG Resources',
  },
  {
    step: 6,
    title: 'AI Reasoning & Cross-Meeting Retrieval',
    description: 'Ask questions inside any meeting or chat. The Coordinator Agent retrieves from past decisions and uploaded resources with exact citations.',
    tab: 'meetings' as const,
    actionText: 'Test Reasoning',
  },
  {
    step: 7,
    title: 'Conflict-Aware Scheduling',
    description: 'The agent checks calendar availability, detects when Rahul is busy at 4 PM, and recommends 5:00 PM with transparent constraint evidence.',
    tab: 'calendar' as const,
    actionText: 'View Calendar Conflicts',
  },
  {
    step: 8,
    title: 'AI Delegate & Safe Attendance',
    description: 'When unavailable, MeetingMind attends as your AI Delegate. It answers questions from memory, obeys strict permission boundaries, and prepares a "WHILE YOU WERE AWAY" report.',
    tab: 'delegate' as const,
    actionText: 'Open AI Delegate',
  },
];

export const DemoTourModal: React.FC<DemoTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSelectMeeting,
  onOpenSimulatedDelegate,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      onNavigateTab(TOUR_STEPS[nextIdx].tab);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      onNavigateTab(TOUR_STEPS[prevIdx].tab);
    }
  };

  const handleExecuteAction = () => {
    onNavigateTab(currentStep.tab);
    if (currentStep.step === 2 && onSelectMeeting) {
      onSelectMeeting('meet-alpha-arch-26');
    } else if (currentStep.step === 8 && onOpenSimulatedDelegate) {
      onOpenSimulatedDelegate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1">
            <span>MeetingMind Guided Tour</span>
            <span>
              Step {currentStep.step} of {TOUR_STEPS.length}
            </span>
          </div>
          <h2 className="text-base font-semibold text-zinc-900">{currentStep.title}</h2>
        </div>

        {/* Step Body */}
        <p className="text-xs text-zinc-600 leading-relaxed mb-6">
          {currentStep.description}
        </p>

        {/* Step Indicator dots */}
        <div className="flex items-center gap-1 mb-6">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStepIndex
                  ? 'w-6 bg-zinc-900'
                  : i < currentStepIndex
                  ? 'w-2 bg-zinc-400'
                  : 'w-2 bg-zinc-200'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 text-xs">
          <button
            onClick={handleExecuteAction}
            className="text-zinc-800 hover:text-black font-medium underline underline-offset-4"
          >
            {currentStep.actionText} →
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className="px-3 py-1.5 rounded text-zinc-600 hover:text-zinc-900 disabled:opacity-30 disabled:hover:text-zinc-600"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-2xs"
            >
              {currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
