import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  X,
  Bot,
  User,
  HelpCircle,
  Volume2,
  VolumeX,
  Calendar,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { coordinator } from '../agent/coordinator';
import { speechService } from '../services/speech';
import { createCalendarEvent } from '../services/calendar';
import { AgentResponse, AgentEvidence } from '../types';
import { EvidenceModal } from './EvidenceModal';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  evidence?: AgentEvidence;
  actionTaken?: string;
  actionPayload?: any;
  suggestedFollowUps?: string[];
  timestamp: string;
}

interface VoiceChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMeeting?: (meetingId: string) => void;
  onSwitchTab?: (tab: 'meetings' | 'memory' | 'tasks' | 'delegate') => void;
  initialPrompt?: string;
}

export const VoiceChatDrawer: React.FC<VoiceChatDrawerProps> = ({
  isOpen,
  onClose,
  onSelectMeeting,
  onSwitchTab,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-init',
      sender: 'agent',
      text: 'Hello! I am your MeetingMind Coordinator. You can ask me about previous decisions, overdue commitments, schedule conflict checks, or what happened while you were away.',
      suggestedFollowUps: [
        'What did we decide about authentication?',
        'Who still has unfinished work?',
        'What are the open commitments for this week?',
      ],
      timestamp: 'Now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<AgentEvidence | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const response = await coordinator.process(query);

      const agentMsg: Message = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: response.message,
        evidence: response.evidence,
        actionTaken: response.actionTaken,
        actionPayload: response.actionPayload,
        suggestedFollowUps: response.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);

      // Read aloud if TTS is active
      if (isTTSActive) {
        speechService.speak(response.message);
      }
    } catch (err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: 'An error occurred while reasoning over meeting records.',
        timestamp: 'Now',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
    } else {
      const started = speechService.startListening(
        (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            handleSendMessage(transcript);
            setIsListening(false);
          }
        },
        (err) => {
          console.warn('Speech recognition error:', err);
          setIsListening(false);
        },
        () => setIsListening(false)
      );
      if (started) setIsListening(true);
    }
  };

  const handleConfirmBooking = async (payload: any) => {
    if (!payload?.recommendedSlot) return;
    const slot = payload.recommendedSlot;
    const title = `Project Sync (${payload.participants.join(' & ')})`;
    await createCalendarEvent(title, payload.participants, slot.start, slot.end);

    setMessages((prev) => [
      ...prev,
      {
        id: `agt-conf-${Date.now()}`,
        sender: 'agent',
        text: `✅ Meeting booked successfully for **${title}** on **${slot.timeLabel}**.\nAdded to local calendar!`,
        timestamp: 'Now',
      },
    ]);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-stone-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-serif text-sm font-bold">
            M
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm text-stone-900">Coordinator Agent</h3>
            <p className="text-[10px] text-stone-500 font-mono">Understand → Retrieve → Reason → Verify</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsTTSActive(!isTTSActive)}
            className={`p-1.5 rounded-md transition-colors ${
              isTTSActive ? 'text-white bg-black' : 'text-stone-400 hover:text-stone-700'
            }`}
            title="Toggle Text-to-Speech Output"
          >
            {isTTSActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-200/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-50/50 text-xs">
        {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';

          return (
            <div key={msg.id} className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}>
              <div className="flex items-center gap-1.5 mb-1 font-mono text-[10px] text-stone-400">
                <span>{isAgent ? 'MeetingMind' : 'You'}</span>
                <span>• {msg.timestamp}</span>
              </div>

              <div
                className={`p-3.5 rounded-xl max-w-[90%] leading-relaxed ${
                  isAgent
                    ? 'bg-white border border-stone-200 text-stone-800 shadow-2xs font-sans'
                    : 'bg-stone-900 text-stone-50'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Confirm Meeting Action Button */}
                {msg.actionPayload?.recommendedSlot && (
                  <div className="mt-3 pt-2.5 border-t border-stone-100">
                    <button
                      onClick={() => handleConfirmBooking(msg.actionPayload)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-black hover:bg-zinc-800 text-white rounded-md transition-all shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Confirm & Book for {msg.actionPayload.recommendedSlot.timeLabel}</span>
                    </button>
                  </div>
                )}

                {/* "Why?" Decision Evidence Button */}
                {msg.evidence && (
                  <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedEvidence(msg.evidence!)}
                      className="flex items-center gap-1 text-[11px] font-mono text-black hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Why? View Evidence</span>
                    </button>
                    <span className="text-[10px] font-mono text-stone-400">
                      {msg.evidence.retrievedSources.length} sources
                    </span>
                  </div>
                )}
              </div>

              {/* Follow-up suggestions */}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                  {msg.suggestedFollowUps.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-sans transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs font-mono text-stone-400 p-2">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span>Reasoning over memory & constraints...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Box */}
      <div className="p-3 border-t border-stone-200 bg-white">
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMic}
            className={`p-2 rounded-lg transition-all ${
              isListening
                ? 'bg-black text-white animate-pulse'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isListening ? 'Listening to speech...' : 'Ask about meetings, commitments, calendar...'}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-stone-800"
          />

          <button
            onClick={() => handleSendMessage()}
            className="p-2 bg-stone-900 hover:bg-black text-stone-50 rounded-lg"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Decision Evidence Modal */}
      <EvidenceModal
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
        evidence={selectedEvidence}
      />
    </div>
  );
};
