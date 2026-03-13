export const GOVERNED_PROOF_SYSTEMS = ['GS', 'JH', 'EL', 'SHARED'] as const
export type GovernedProofSystem = (typeof GOVERNED_PROOF_SYSTEMS)[number]

export const GOVERNED_PROOF_TASK_TYPES = [
  'discover_gap',
  'resolve_identity',
  'enrich_record',
  'link_records',
  'validate_record',
  'assemble_proof',
  'refresh_bundle',
  'review_required',
] as const
export type GovernedProofTaskType = (typeof GOVERNED_PROOF_TASK_TYPES)[number]

export const GOVERNED_PROOF_TASK_STATUSES = [
  'queued',
  'claimed',
  'running',
  'blocked',
  'failed',
  'completed',
] as const
export type GovernedProofTaskStatus = (typeof GOVERNED_PROOF_TASK_STATUSES)[number]

export const GOVERNED_PROOF_QUEUE_LANES = [
  'hot',
  'core',
  'repair',
  'exploration',
] as const
export type GovernedProofQueueLane = (typeof GOVERNED_PROOF_QUEUE_LANES)[number]

export const GOVERNED_PROOF_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const
export type GovernedProofPriority = (typeof GOVERNED_PROOF_PRIORITIES)[number]

export const GOVERNED_PROOF_REVIEW_STATUSES = [
  'not_required',
  'pending',
  'approved',
  'rejected',
] as const
export type GovernedProofReviewStatus =
  (typeof GOVERNED_PROOF_REVIEW_STATUSES)[number]

export const GOVERNED_PROOF_PROMOTION_STATUSES = [
  'draft',
  'internal',
  'partner',
  'public',
  'suppressed',
] as const
export type GovernedProofPromotionStatus =
  (typeof GOVERNED_PROOF_PROMOTION_STATUSES)[number]

export const GOVERNED_PROOF_LIFECYCLE_STATUSES = [
  'raw',
  'resolved',
  'enriched',
  'linked',
  'validated',
  'published',
] as const
export type GovernedProofLifecycleStatus =
  (typeof GOVERNED_PROOF_LIFECYCLE_STATUSES)[number]

export const GOVERNED_PROOF_RUN_RESULTS = [
  'success',
  'partial',
  'failed',
] as const
export type GovernedProofRunResult = (typeof GOVERNED_PROOF_RUN_RESULTS)[number]

export type GovernedProofSubjectType =
  | 'organization'
  | 'place'
  | 'program'
  | 'funder'
  | 'grant'

export interface GovernedProofTask {
  id: string
  taskType: GovernedProofTaskType
  status: GovernedProofTaskStatus
  queueLane: GovernedProofQueueLane
  priority: GovernedProofPriority
  ownerSystem: GovernedProofSystem
  systemScope: GovernedProofSystem[]
  targetType: string
  targetId: string
  valueScore: number
  confidenceRequired: number
  inputPayload: Record<string, unknown>
  acceptanceChecks: string[]
  reviewStatus: GovernedProofReviewStatus
  promotionStatus: GovernedProofPromotionStatus
  attemptCount: number
  claimedBy?: string | null
  startedAt?: string | null
  completedAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

export interface GovernedProofRun {
  id: string
  taskId: string
  agentRole: string
  provider: string
  model?: string | null
  promptVersion?: string | null
  strategyVersion?: string | null
  inputHash: string
  outputHash?: string | null
  resultStatus: GovernedProofRunResult
  evalScore?: number | null
  confidenceDelta?: number | null
  costUsd?: number | null
  durationMs?: number | null
  notes?: string | null
  runPayload: Record<string, unknown>
  createdAt: string
}

export interface GovernedProofBundle {
  id: string
  bundleKey: string
  subjectType: GovernedProofSubjectType
  subjectId: string
  ownerSystem: GovernedProofSystem
  lifecycleStatus: GovernedProofLifecycleStatus
  reviewStatus: GovernedProofReviewStatus
  promotionStatus: GovernedProofPromotionStatus
  overallConfidence: number
  capitalConfidence?: number | null
  evidenceConfidence?: number | null
  voiceConfidence?: number | null
  governanceConfidence?: number | null
  capitalContext: Record<string, unknown>
  evidenceContext: Record<string, unknown>
  voiceContext: Record<string, unknown>
  governanceContext: Record<string, unknown>
  outputContext: Record<string, unknown>
  freshnessAt?: string | null
  lastValidatedAt?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface GovernedProofBundleRecord {
  id: string
  bundleId: string
  recordSystem: Extract<GovernedProofSystem, 'GS' | 'JH' | 'EL'>
  recordType: string
  recordId: string
  linkRole: string
  confidenceScore: number
  provenancePayload: Record<string, unknown>
  createdAt: string
}
