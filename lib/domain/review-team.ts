export type ReviewTeamModel = 'gpt' | 'claude' | 'scout';
export type ReviewTeamPhase = 'independent' | 'cross_review' | 'synthesis';
export type ReviewVerdict = 'approve' | 'request_changes' | 'comment';
export type ReviewSeverity = 'blocker' | 'high' | 'medium' | 'low';

export interface ReviewTeamMission {
   id: string;
   issueId: string;
   headSha: string;
   status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'canceled';
   phase: 'queued' | ReviewTeamPhase | 'completed';
   verdict?: ReviewVerdict;
   summary?: string;
   confidence?: number;
   createdAt: number;
}

export interface ReviewTeamAnalysis {
   id: string;
   missionId: string;
   model: ReviewTeamModel;
   phase: ReviewTeamPhase;
   status: 'queued' | 'running' | 'succeeded' | 'failed';
   summary?: string;
   recommendation?: ReviewVerdict;
   confidence?: number;
}

export interface ReviewTeamFinding {
   id: string;
   missionId: string;
   category: 'correctness' | 'security' | 'tests' | 'performance' | 'maintainability';
   severity: ReviewSeverity;
   title: string;
   body: string;
   evidence: string;
   path?: string;
   line?: number;
   raisedBy: Array<'gpt' | 'claude'>;
   challengedBy: Array<'gpt' | 'claude'>;
   resolution: 'confirmed' | 'disputed' | 'dismissed';
   confidence: number;
}

export const REVIEW_TEAM_STAGES: Array<{
   model: ReviewTeamModel;
   phase: ReviewTeamPhase;
   label: string;
   detail: string;
}> = [
   { model: 'gpt', phase: 'independent', label: 'GPT review', detail: 'Independent analysis' },
   {
      model: 'claude',
      phase: 'independent',
      label: 'Claude review',
      detail: 'Independent analysis',
   },
   { model: 'gpt', phase: 'cross_review', label: 'GPT critique', detail: 'Challenges Claude' },
   {
      model: 'claude',
      phase: 'cross_review',
      label: 'Claude critique',
      detail: 'Challenges GPT',
   },
   { model: 'scout', phase: 'synthesis', label: 'Scout verdict', detail: 'Reconciles evidence' },
];

export function reviewFindingFingerprint(input: {
   category: string;
   title: string;
   path?: string;
   line?: number;
}): string {
   const value = [input.category, input.path ?? '', input.line ?? '', input.title]
      .join('|')
      .toLowerCase();
   let hash = 2166136261;
   for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
   }
   return (hash >>> 0).toString(36);
}

export function normalizedConfidence(value: number): number {
   return Math.max(0, Math.min(1, value));
}
