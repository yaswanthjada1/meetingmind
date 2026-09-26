import { DelegatePermissions } from '../types';

export type PermissionCheckResult = {
  allowed: boolean;
  status: 'ALLOW' | 'ASK' | 'DENY';
  reason: string;
  suggestedAction?: string;
};

export type SensitiveActionType =
  | 'answer_question'
  | 'retrieve_history'
  | 'take_notes'
  | 'create_task'
  | 'accept_task'
  | 'change_deadline'
  | 'make_technical_decision'
  | 'make_financial_decision'
  | 'make_legal_decision'
  | 'schedule_meeting';

/**
 * Deterministic Permission Engine.
 * Evaluates any requested delegate action against the hard permission boundary.
 * Never allows the LLM to determine its own permissions.
 */
export function evaluateDelegatePermission(
  actionType: SensitiveActionType,
  permissions: DelegatePermissions,
  details?: { owner?: string; deadline?: string; topic?: string }
): PermissionCheckResult {
  switch (actionType) {
    case 'answer_question':
      if (permissions.canAnswerQuestions) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Factual question answering from retrieved memory is permitted by delegate policy.',
        };
      }
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Question answering is disabled in delegate configuration.',
      };

    case 'retrieve_history':
      if (permissions.canRetrieveHistory) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Accessing indexed historical notes and decisions is permitted.',
        };
      }
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Historical memory retrieval is disabled in delegate configuration.',
      };

    case 'take_notes':
      return {
        allowed: permissions.canTakeNotes,
        status: permissions.canTakeNotes ? 'ALLOW' : 'DENY',
        reason: permissions.canTakeNotes ? 'Note-taking is permitted.' : 'Note-taking is restricted.',
      };

    case 'create_task':
      if (permissions.canCreateTasks) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Delegate is authorized to record and create assigned tasks for follow-up.',
        };
      }
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Task creation is restricted.',
      };

    case 'accept_task':
      if (permissions.canAcceptTasks) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'User has explicitly granted permission to accept new task commitments.',
        };
      }
      return {
        allowed: false,
        status: 'ASK',
        reason: 'Delegate cannot commit to new obligations without explicit user confirmation.',
        suggestedAction: 'Record as a proposed commitment requiring user review.',
      };

    case 'change_deadline':
      if (permissions.canChangeDeadlines) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Delegate has explicit permission to negotiate deadline changes.',
        };
      }
      return {
        allowed: false,
        status: 'ASK',
        reason: 'Delegate does not have authority to alter committed project milestones or deadlines.',
        suggestedAction: 'Record proposal in "Needs Attention" and state refusal politely to participants.',
      };

    case 'make_technical_decision':
      if (permissions.canMakeTechnicalDecisions) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Technical architectural decisions permitted.',
        };
      }
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Technical architectural decisions are strictly reserved for the engineering lead.',
        suggestedAction: 'Refuse decision authority and log for technical review.',
      };

    case 'make_financial_decision':
    case 'make_legal_decision':
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Financial and legal commitments are permanently restricted for AI delegates.',
        suggestedAction: 'Refuse authorization.',
      };

    case 'schedule_meeting':
      if (permissions.canScheduleMeetings) {
        return {
          allowed: true,
          status: 'ALLOW',
          reason: 'Autonomous scheduling is enabled.',
        };
      }
      return {
        allowed: false,
        status: 'ASK',
        reason: 'Scheduling requires user confirmation before finalizing slot booking.',
        suggestedAction: 'Propose slot to user and await confirmation.',
      };

    default:
      return {
        allowed: false,
        status: 'DENY',
        reason: 'Unknown action type denied by default safety boundary.',
      };
  }
}
