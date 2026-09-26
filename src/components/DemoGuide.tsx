import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  Calendar,
  Layers,
  X,
} from 'lucide-react';

interface DemoGuideProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  onExecuteStep: (stepNumber: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const DEMO_STEPS = [
  {
    step: 1,
    title: 'Load Demo Workspace',
    description: 'Populates IndexedDB with 3 past meetings, 4 teammates, decisions, commitments & calendar events.',
    actionLabel: 'Load Workspace',
  },
  {
    step: 2,
    title: 'Query Meeting Memory',
    description: 'Ask: "What did we decide about authentication?" to retrieve evidence from the 26 Sept meeting.',
    actionLabel: 'Ask: Auth Decision',
  },
  {
    step: 3,
    title: 'Query Unfinished Work',
    description: 'Ask: "Who still has unfinished work?" to find Rahul\'s overdue commitment & pending tasks.',
    actionLabel: 'Ask: Unfinished Work',
  },
  {
    step: 4,
    title: 'Conflict-Aware Scheduling',
    description: 'Schedule: "Meet with Rahul tomorrow at 4". Agent detects Rahul\'s conflict and recommends 5:00 PM.',
    actionLabel: 'Schedule: 4 PM Conflict',
  },
  {
    step: 5,
    title: 'Detect User Unavailability',
    description: 'Trigger an urgent conflict for Yaswanth during Sprint Sync: App offers "Enable AI Delegate?".',
    actionLabel: 'Simulate Unavailability',
  },
  {
    step: 6,
    title: 'Enable AI Delegate Mode',
    description: 'Configure deterministic permission matrix (canChangeDeadlines = ASK/REFUSE).',
    actionLabel: 'Configure Permissions',
  },
  {
    step: 7,
    title: 'Delegate Factual Response',
    description: 'Simulated Meeting asks: "What did Yaswanth suggest for authentication?" -> Delegate answers from memory.',
    actionLabel: 'Simulate: Factual Q&A',
  },
  {
    step: 8,
    title: 'Delegate Permission Boundary',
    description: 'Participant asks to "Move deployment deadline to Monday" -> Delegate refuses & flags for review.',
    actionLabel: 'Simulate: Unauthorized Proposal',
  },
  {
    step: 9,
    title: 'Post-Meeting Briefing',
    description: 'View "WHILE YOU WERE AWAY" report with attended actions and 🔴 Needs Attention item.',
    actionLabel: 'View "While You Were Away"',
  },
];

export const DemoGuide: React.FC<DemoGuideProps> = ({
  currentStep,
  setCurrentStep,
  onExecuteStep,
  onClose,
  isOpen,
}) => {
  if (!isOpen) return null;

  const activeStepObj = DEMO_STEPS[currentStep - 1] || DEMO_STEPS[0];

  return (
    <div className="bg-amber-50/90 border-b border-amber-200/90 px-6 py-2.5 text-stone-800 transition-all shadow-2xs">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-mono font-bold">
            {activeStepObj.step}/9
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-amber-950 uppercase tracking-wider">
                Demo Step {activeStepObj.step}:
              </span>
              <span className="text-sm font-medium text-stone-900">{activeStepObj.title}</span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 max-w-xl">{activeStepObj.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => onExecuteStep(activeStepObj.step)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-900 text-amber-50 hover:bg-black rounded-md transition-all shadow-xs"
          >
            <Play className="w-3 h-3 text-amber-300" />
            <span>{activeStepObj.actionLabel}</span>
          </button>

          <div className="flex items-center border-l border-amber-200 pl-2 space-x-1">
            <button
              disabled={currentStep <= 1}
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-30 rounded hover:bg-amber-100"
            >
              Prev
            </button>
            <button
              disabled={currentStep >= DEMO_STEPS.length}
              onClick={() => setCurrentStep(Math.min(DEMO_STEPS.length, currentStep + 1))}
              className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-30 rounded hover:bg-amber-100"
            >
              Next
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-500 hover:text-stone-800 rounded hover:bg-amber-100 ml-1"
              title="Close guide bar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
