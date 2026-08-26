'use client';

import {
   AlertTriangle,
   Check,
   CheckCircle2,
   Circle,
   GitCompareArrows,
   Loader2,
   MessageSquareText,
   ShieldAlert,
   XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useReviewTeam } from '@/hooks/use-workspace-data';
import { REVIEW_TEAM_STAGES, type ReviewSeverity } from '@/lib/domain/review-team';
import { cn } from '@/lib/utils';

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
   blocker: 0,
   high: 1,
   medium: 2,
   low: 3,
};

const VERDICT = {
   approve: { label: 'Approve', icon: CheckCircle2, className: 'text-emerald-600' },
   request_changes: {
      label: 'Request changes',
      icon: ShieldAlert,
      className: 'text-red-600',
   },
   comment: { label: 'Comment', icon: MessageSquareText, className: 'text-amber-600' },
} as const;

export function ReviewTeam({
   orgId,
   pullRequestUrl,
   headSha,
}: {
   orgId: string;
   pullRequestUrl: string;
   headSha: string;
}) {
   const { mission, analyses, findings } = useReviewTeam(pullRequestUrl, headSha);
   const verdict = mission?.verdict ? VERDICT[mission.verdict] : undefined;
   const VerdictIcon = verdict?.icon;
   const active = mission && ['queued', 'running', 'waiting'].includes(mission.status);

   return (
      <section className="flex flex-col gap-3">
         <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Cross-review team</h2>
            <Badge variant="outline" className="h-5 px-1.5 font-normal text-[10px]">
               GPT-5.6 Terra
            </Badge>
            <GitCompareArrows className="size-3 text-muted-foreground" />
            <Badge variant="outline" className="h-5 px-1.5 font-normal text-[10px]">
               Claude Sonnet 4.6
            </Badge>
         </div>

         <div className="rounded-lg border overflow-hidden">
            {!mission ? (
               <div className="px-4 py-5 text-sm">
                  <p className="font-medium">Two independent reviews, then a cross-check.</p>
                  <p className="mt-1 text-muted-foreground">
                     Deploy the review team above. GPT and Claude inspect the same revision,
                     challenge each other’s claims, and Scout publishes one evidence-backed verdict.
                  </p>
               </div>
            ) : (
               <>
                  <div className="flex items-start gap-3 px-4 py-3 border-b bg-muted/20">
                     {active ? (
                        <Loader2 className="size-4 mt-0.5 animate-spin text-muted-foreground" />
                     ) : VerdictIcon ? (
                        <VerdictIcon className={cn('size-4 mt-0.5', verdict.className)} />
                     ) : mission.status === 'failed' ? (
                        <XCircle className="size-4 mt-0.5 text-red-600" />
                     ) : (
                        <AlertTriangle className="size-4 mt-0.5 text-amber-600" />
                     )}
                     <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-medium">
                              {active
                                 ? phaseLabel(mission.phase)
                                 : (verdict?.label ?? statusLabel(mission.status))}
                           </span>
                           {mission.confidence !== undefined ? (
                              <span className="text-xs text-muted-foreground">
                                 {Math.round(mission.confidence * 100)}% confidence
                              </span>
                           ) : null}
                        </div>
                        {mission.summary ? (
                           <p className="mt-1 text-sm text-muted-foreground">{mission.summary}</p>
                        ) : null}
                     </div>
                     <Link
                        href={`/${orgId}/issue/${mission.issueId}`}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                     >
                        Open issue
                     </Link>
                  </div>

                  <div className="grid sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x">
                     {REVIEW_TEAM_STAGES.map((stage) => {
                        const analysis = analyses.find(
                           (candidate) =>
                              candidate.model === stage.model && candidate.phase === stage.phase
                        );
                        return (
                           <div key={`${stage.model}:${stage.phase}`} className="px-3 py-3 min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                 <StageIcon status={analysis?.status ?? 'queued'} />
                                 <span className="truncate">{stage.label}</span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                                 {analysis?.summary ?? stage.detail}
                              </p>
                           </div>
                        );
                     })}
                  </div>

                  {findings.length > 0 ? (
                     <div className="border-t divide-y">
                        {[...findings]
                           .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
                           .map((finding) => (
                              <article key={finding.id} className="px-4 py-3">
                                 <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                       className={cn(
                                          'text-[10px] uppercase font-semibold tracking-wide',
                                          finding.severity === 'blocker' ||
                                             finding.severity === 'high'
                                             ? 'text-red-600'
                                             : finding.severity === 'medium'
                                               ? 'text-amber-600'
                                               : 'text-muted-foreground'
                                       )}
                                    >
                                       {finding.severity}
                                    </span>
                                    <span className="text-sm font-medium">{finding.title}</span>
                                    {finding.path ? (
                                       <span className="font-mono text-[11px] text-muted-foreground">
                                          {finding.path}
                                          {finding.line ? `:${finding.line}` : ''}
                                       </span>
                                    ) : null}
                                    <span className="ml-auto text-[11px] text-muted-foreground">
                                       {finding.resolution === 'disputed'
                                          ? 'Disputed'
                                          : `Confirmed · ${Math.round(finding.confidence * 100)}%`}
                                    </span>
                                 </div>
                                 <p className="mt-1 text-sm text-muted-foreground">
                                    {finding.body}
                                 </p>
                                 <p className="mt-1.5 text-xs">
                                    <span className="text-muted-foreground">Evidence: </span>
                                    {finding.evidence}
                                 </p>
                                 <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span>
                                       Raised by {finding.raisedBy.map(modelName).join(' + ')}
                                    </span>
                                    {finding.challengedBy.length ? (
                                       <span>
                                          · challenged by{' '}
                                          {finding.challengedBy.map(modelName).join(' + ')}
                                       </span>
                                    ) : null}
                                 </div>
                              </article>
                           ))}
                     </div>
                  ) : mission.status === 'succeeded' ? (
                     <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                        No actionable findings survived cross-review.
                     </div>
                  ) : null}
               </>
            )}
         </div>
      </section>
   );
}

function StageIcon({ status }: { status: 'queued' | 'running' | 'succeeded' | 'failed' }) {
   if (status === 'running')
      return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
   if (status === 'succeeded') return <Check className="size-3 text-emerald-600" />;
   if (status === 'failed') return <XCircle className="size-3 text-red-600" />;
   return <Circle className="size-3 text-muted-foreground/60" />;
}

function modelName(model: 'gpt' | 'claude') {
   return model === 'gpt' ? 'GPT' : 'Claude';
}

function phaseLabel(phase: string) {
   if (phase === 'independent') return 'Independent reviews in progress';
   if (phase === 'cross_review') return 'Models are challenging each other';
   if (phase === 'synthesis') return 'Scout is reconciling the evidence';
   return 'Review team queued';
}

function statusLabel(status: string) {
   if (status === 'failed') return 'Review team failed';
   if (status === 'canceled') return 'Review team canceled';
   if (status === 'waiting') return 'Review team needs attention';
   return 'Review complete';
}
