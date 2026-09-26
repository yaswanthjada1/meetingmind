import React from 'react';
import { AgentEvidence } from '../types';
import { Shield, Sparkles, X, Database, CheckCircle2, FileText, AlertCircle } from 'lucide-react';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: AgentEvidence | null;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  onClose,
  evidence,
}) => {
  if (!isOpen || !evidence) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200 rounded-xl shadow-xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-md hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-black text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-base text-stone-900">
              Why? — Decision Evidence
            </h3>
            <p className="text-xs text-stone-500 font-mono">
              Transparent reasoning & retrieved local constraints
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs font-sans">
          {/* Selected Action */}
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
            <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold block mb-1">
              Selected Action
            </span>
            <p className="font-semibold text-stone-900">{evidence.selectedAction}</p>
          </div>

          {/* Rationale */}
          <div>
            <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold block mb-1">
              Rationale
            </span>
            <p className="text-stone-700 leading-relaxed bg-white p-3 rounded-lg border border-stone-200">
              {evidence.rationale}
            </p>
          </div>

          {/* Inputs & Constraints */}
          {evidence.constraints && evidence.constraints.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold block mb-1">
                Constraints Evaluated
              </span>
              <ul className="space-y-1 bg-stone-50 p-3 rounded-lg border border-stone-200 text-stone-700">
                {evidence.constraints.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-black font-bold">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Retrieved Sources */}
          {evidence.retrievedSources && evidence.retrievedSources.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold block mb-1">
                Retrieved Local Evidence Sources ({evidence.retrievedSources.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {evidence.retrievedSources.map((src, i) => (
                  <div key={i} className="p-2.5 rounded bg-stone-50 border border-stone-200">
                    <span className="font-mono font-semibold text-stone-800 text-[11px]">
                      {src.title}
                    </span>
                    <p className="text-[11px] text-stone-600 mt-0.5">{src.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-3 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
