import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Mic,
  MicOff,
  Sparkles,
  ChevronDown,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { coordinator } from '../agent/coordinator';
import { speechService } from '../services/speech';
import { AgentEvidence } from '../types';
import { EvidenceModal } from './EvidenceModal';

interface FloatingChatbotProps {
  currentContext?: {
    tab: string;
    meetingTitle?: string;
    meetingId?: string;
    resourceTitle?: string;
    initialQuery?: string;
  };
  forceOpen?: boolean;
}

export const FloatingChatbot: React.FC<FloatingChatbotProps> = ({ currentContext, forceOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; sender: 'user' | 'agent'; text: string; evidence?: AgentEvidence }>
  >([
    {
      id: 'init-1',
      sender: 'agent',
      text: 'Ask me about your meetings, decisions, commitments, or background resources.',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<AgentEvidence | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  useEffect(() => {
    if (currentContext?.resourceTitle) {
      setIsOpen(true);
      if (currentContext.initialQuery) {
        handleSendMessage(currentContext.initialQuery);
      }
    }
  }, [currentContext?.resourceTitle, currentContext?.initialQuery]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isThinking]);

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputQuery).trim();
    if (!q) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user' as const,
      text: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    try {
      // Build context-aware prompt prefix
      let contextualPrompt = q;
      if (currentContext?.resourceTitle) {
        contextualPrompt = `Regarding document "${currentContext.resourceTitle}": ${q}`;
      } else if (currentContext?.meetingTitle) {
        contextualPrompt = `Regarding current meeting "${currentContext.meetingTitle}": ${q}`;
      } else if (currentContext?.tab === 'resources') {
        contextualPrompt = `Regarding uploaded project resources: ${q}`;
      }

      const response = await coordinator.process(contextualPrompt);

      const agentMsg = {
        id: `agt-${Date.now()}`,
        sender: 'agent' as const,
        text: response.message,
        evidence: response.evidence,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: 'Unable to retrieve meeting memory right now.',
        },
      ]);
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
          setInputQuery(transcript);
          if (isFinal) {
            handleSendMessage(transcript);
            setIsListening(false);
          }
        },
        () => setIsListening(false),
        () => setIsListening(false)
      );
      if (started) setIsListening(true);
    }
  };

  return (
    <>
      {/* Floating Bottom-Right Trigger Button */}
      <div className="fixed right-6 bottom-6 z-40">
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 rounded-full bg-zinc-900 hover:bg-black text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all group relative border border-zinc-700"
            title="Ask MeetingMind"
          >
            <Bot className="w-5 h-5 text-zinc-100" />
            <div className="absolute right-14 px-2.5 py-1 bg-zinc-900 text-white text-[11px] rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
              Ask MeetingMind
            </div>
          </button>
        ) : (
          /* Compact Floating Popup Chat Panel */
          <div className="w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[460px] animate-in slide-in-from-bottom-5 duration-150 font-sans">
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold">MeetingMind</h3>
                <p className="text-[10px] text-zinc-400 font-mono">
                  {currentContext?.resourceTitle
                    ? `Doc: ${currentContext.resourceTitle}`
                    : currentContext?.meetingTitle
                    ? `Meeting: ${currentContext.meetingTitle}`
                    : 'Context: Knowledge & Memory'}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-zinc-50/50 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[88%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-800 shadow-2xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.evidence && (
                      <button
                        onClick={() => setSelectedEvidence(msg.evidence!)}
                        className="mt-2 pt-1.5 border-t border-zinc-100 text-[10px] font-mono text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Why? View evidence ({msg.evidence.retrievedSources.length} sources)</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 p-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-2.5 bg-white border-t border-zinc-200">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-black text-white animate-pulse'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                  title="Voice input"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>

                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isListening ? 'Listening...' : 'Ask anything...'}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
                />

                <button
                  onClick={() => handleSendMessage()}
                  className="p-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decision Evidence Inspection Modal */}
      <EvidenceModal
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
        evidence={selectedEvidence}
      />
    </>
  );
};
