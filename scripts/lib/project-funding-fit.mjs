const INSTRUMENT_ALIASES = new Map([
  ['grant', ['grant', 'grants', 'grant funding']],
  ['philanthropic_grant', ['philanthropic grant', 'foundation funding', 'charitable grant']],
  ['donation', ['donation', 'gift funding']],
  ['loan', ['loan', 'debt finance', 'business finance']],
  ['concessional_loan', ['concessional loan', 'below market loan', 'low interest loan', 'patient loan']],
  ['impact_investment', ['impact investment', 'impact capital', 'patient capital', 'catalytic capital']],
  ['recoverable_grant', ['recoverable grant', 'repayable grant']],
  ['equity', ['equity investment', 'equity capital']],
  ['other_repayable', ['repayable capital', 'working capital facility', 'purchase order finance', 'inventory finance']],
]);

const ORG_TYPE_ALIASES = new Map([
  ['charity', ['charity', 'registered charity', 'acnc registered charity']],
  ['registered_charity', ['registered charity', 'acnc registered']],
  ['not_for_profit', ['not for profit', 'not-for-profit', 'nonprofit', 'non-profit', 'nfp']],
  ['dgr', ['deductible gift recipient', 'dgr']],
  ['pbi', ['public benevolent institution', 'pbi']],
  ['company', ['company', 'corporation', 'incorporated business']],
  ['pty_ltd', ['pty ltd', 'proprietary limited', 'australian company']],
  ['business', ['business', 'enterprise']],
  ['social_enterprise', ['social enterprise', 'purpose driven enterprise', 'purpose-driven enterprise']],
  ['small_business', ['small business', 'sme']],
]);

const CLOSED_STATUSES = new Set(['closed', 'expired', 'archived', 'inactive', 'awarded']);

export function normaliseFundingText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function array(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function containsPhrase(haystack, phrase) {
  const target = normaliseFundingText(phrase);
  if (!target) return false;
  if (target.length <= 3) {
    return new RegExp(`(^|\\s)${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(haystack);
  }
  return haystack.includes(target);
}

function candidateHost(candidate) {
  const value = candidate.sourceUrl ?? candidate.source_url ?? candidate.url ?? candidate.applicationUrl ?? candidate.application_url;
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostMatches(host, rule) {
  const target = normaliseFundingText(rule).replace(/\s+/g, '.');
  return Boolean(host && target && (host === target || host.endsWith(`.${target}`)));
}

function candidateText(candidate) {
  return normaliseFundingText([
    candidate.name,
    candidate.funderName,
    candidate.funder_name,
    candidate.provider,
    candidate.description,
    candidate.requirements,
    candidate.requirementsSummary,
    candidate.requirements_summary,
    typeof candidate.eligibilityCriteria === 'string' ? candidate.eligibilityCriteria : JSON.stringify(candidate.eligibilityCriteria ?? ''),
    typeof candidate.eligibility_criteria === 'string' ? candidate.eligibility_criteria : JSON.stringify(candidate.eligibility_criteria ?? ''),
    ...array(candidate.categories),
    ...array(candidate.focusAreas ?? candidate.focus_areas),
    ...array(candidate.targetRecipients ?? candidate.target_recipients),
    ...array(candidate.supportedCostTypes ?? candidate.supported_cost_types),
    ...array(candidate.excludedCostTypes ?? candidate.excluded_cost_types),
  ].filter(Boolean).join(' '));
}

function explicitInstruments(candidate) {
  const raw = unique([
    ...array(candidate.instrument),
    ...array(candidate.instruments),
  ]).map(normaliseFundingText);
  const known = new Set();
  for (const value of raw) {
    if (INSTRUMENT_ALIASES.has(value)) known.add(value);
    for (const [canonical, aliases] of INSTRUMENT_ALIASES) {
      if (aliases.some((alias) => containsPhrase(value, alias))) known.add(canonical);
    }
  }
  return [...known];
}

function inferredInstruments(candidate, text) {
  const explicit = explicitInstruments(candidate);
  if (explicit.length) return { values: explicit, evidence: 'explicit' };

  const inferred = [];
  for (const [canonical, aliases] of INSTRUMENT_ALIASES) {
    if (aliases.some((alias) => containsPhrase(text, alias))) inferred.push(canonical);
  }
  if (candidate.opportunityKind === 'grant' || candidate.opportunity_kind === 'grant') inferred.push('grant');
  if (candidate.opportunityKind === 'loan' || candidate.opportunity_kind === 'loan') inferred.push('loan');
  if (candidate.opportunityKind === 'investment' || candidate.opportunity_kind === 'investment') inferred.push('impact_investment');
  return { values: unique(inferred), evidence: inferred.length ? 'text_inference' : 'unknown' };
}

function inferredOpportunityKind(candidate, text, instruments) {
  const explicit = normaliseFundingText(candidate.opportunityKind ?? candidate.opportunity_kind ?? '');
  if (explicit) return explicit.replace(/\s+/g, '_');
  const title = normaliseFundingText(candidate.name);
  if (['procurement', 'tender', 'request for tender', 'request for quote', 'supplier opportunity'].some((term) => containsPhrase(title, term))) return 'procurement';
  if (['scholarship', 'bursary'].some((term) => containsPhrase(title, term))) return 'scholarship';
  if (['job', 'vacancy', 'employment opportunity'].some((term) => containsPhrase(title, term))) return 'job';
  if (instruments.some((value) => ['loan', 'concessional_loan', 'other_repayable'].includes(value))) return 'loan';
  if (instruments.some((value) => ['impact_investment', 'equity'].includes(value))) return 'investment';
  if (instruments.some((value) => ['grant', 'philanthropic_grant', 'donation', 'recoverable_grant'].includes(value))) return 'grant';
  if (containsPhrase(text, 'applications open') || containsPhrase(text, 'funding round')) return 'grant';
  return 'unknown';
}

function inferredEligibleOrgTypes(candidate, text) {
  const explicit = unique([
    ...array(candidate.eligibleOrgTypes ?? candidate.eligible_org_types),
  ]).map((value) => normaliseFundingText(value).replace(/\s+/g, '_'));
  const values = new Set(explicit);
  const eligibilityKnown = candidate.eligibilityKnown === true || candidate.eligibility_known === true;

  const flagMap = [
    ['acceptsCharity', 'charity'],
    ['accepts_charity', 'charity'],
    ['acceptsPtyLtd', 'pty_ltd'],
    ['accepts_pty_ltd', 'pty_ltd'],
    ['acceptsSoleTrader', 'business'],
    ['accepts_sole_trader', 'business'],
  ];
  let hasExplicitFlag = false;
  for (const [field, canonical] of flagMap) {
    if (typeof candidate[field] === 'boolean') hasExplicitFlag = true;
    if (candidate[field] === true) values.add(canonical);
  }

  if (!values.size && !hasExplicitFlag && !eligibilityKnown) {
    for (const [canonical, aliases] of ORG_TYPE_ALIASES) {
      if (aliases.some((alias) => containsPhrase(text, alias))) values.add(canonical);
    }
  }

  return {
    values: [...values],
    known: explicit.length > 0 || hasExplicitFlag || eligibilityKnown,
    evidence: explicit.length > 0 || hasExplicitFlag || eligibilityKnown ? 'explicit' : values.size ? 'text_inference' : 'unknown',
  };
}

function inferredOwnershipGate(candidate, text) {
  const explicit = candidate.ownershipGate ?? candidate.ownership_gate;
  if (explicit && typeof explicit === 'object' && typeof explicit.required === 'boolean') {
    return {
      required: explicit.required,
      thresholdPercent: finiteNumber(explicit.thresholdPercent ?? explicit.threshold_percent),
      evidence: explicit.evidence ?? 'explicit',
    };
  }
  if (typeof candidate.indigenousOwnershipRequired === 'boolean') {
    return {
      required: candidate.indigenousOwnershipRequired,
      thresholdPercent: finiteNumber(candidate.indigenousOwnershipThreshold),
      evidence: 'explicit',
    };
  }

  const requiredPatterns = [
    /(?:must|only|eligible applicants? (?:must|are required to))[^.]{0,80}(?:indigenous|aboriginal|first nations)[^.]{0,50}(?:owned|controlled)/,
    /(?:at least|minimum of)\s*(\d{1,3})\s*%[^.]{0,50}(?:indigenous|aboriginal|first nations)[^.]{0,30}(?:owned|control)/,
    /(?:indigenous|aboriginal|first nations)[^.]{0,40}(?:owned|controlled)[^.]{0,30}(?:businesses|organisations|organizations)\s+only/,
  ];
  for (const pattern of requiredPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        required: true,
        thresholdPercent: finiteNumber(match[1]),
        evidence: 'text_inference',
      };
    }
  }

  const noGatePatterns = [
    'no indigenous ownership requirement',
    'indigenous ownership is not required',
    'open to indigenous and non indigenous organisations',
  ];
  if (noGatePatterns.some((pattern) => containsPhrase(text, pattern))) {
    return { required: false, thresholdPercent: null, evidence: 'text_inference' };
  }
  return { required: null, thresholdPercent: null, evidence: 'unknown' };
}

function geographyValues(candidate) {
  return unique([
    ...array(candidate.geography),
    ...array(candidate.geographies),
    ...array(candidate.states),
  ]).map((value) => normaliseFundingText(String(value).replace(/^AU-/i, '')));
}

function amountOverlaps(candidateMin, candidateMax, block) {
  if (candidateMin === null && candidateMax === null) return null;
  const low = candidateMin ?? 0;
  const high = candidateMax ?? Number.POSITIVE_INFINITY;
  return high >= block.amountMin && low <= block.amountMax;
}

function inferBlockMatches(profile, candidate) {
  const explicitIds = new Set(array(candidate.fundingBlockIds ?? candidate.funding_block_ids));
  const explicitCostTypes = array(candidate.supportedCostTypes ?? candidate.supported_cost_types);
  const fallbackCostText = [
    candidate.description,
    candidate.requirements,
    candidate.requirementsSummary,
    candidate.requirements_summary,
    typeof candidate.eligibilityCriteria === 'string' ? candidate.eligibilityCriteria : JSON.stringify(candidate.eligibilityCriteria ?? ''),
    typeof candidate.eligibility_criteria === 'string' ? candidate.eligibility_criteria : JSON.stringify(candidate.eligibility_criteria ?? ''),
    ...array(candidate.categories),
    ...array(candidate.focusAreas ?? candidate.focus_areas),
  ].filter(Boolean).join(' ');
  const supportedText = normaliseFundingText(candidate.costEvidenceKnown === true
    ? explicitCostTypes.join(' ')
    : candidate.costEvidenceKnown === false
      ? ''
      : explicitCostTypes.length
        ? explicitCostTypes.join(' ')
        : fallbackCostText);

  return profile.fundingNeed.blocks
    .map((block) => {
      const keywordHits = array(block.keywords).filter((keyword) => containsPhrase(supportedText, keyword));
      const explicit = explicitIds.has(block.id);
      return {
        id: block.id,
        label: block.label,
        entityId: block.entityId,
        lane: block.lane,
        priority: Number(block.priority || 0),
        hardestMoney: Boolean(block.hardestMoney),
        explicit,
        keywordHits,
        amountOverlap: null,
      };
    })
    .filter((match) => match.explicit || match.keywordHits.length > 0);
}

function eligibleEntityPaths(profile, eligibleOrgTypes, instruments, candidate) {
  const requiredDgr = candidate.dgrRequired === true || candidate.dgr_required === true;
  const paths = [];
  for (const entity of profile.entities) {
    const typeMatch = !eligibleOrgTypes.known || entity.acceptedOrgTypes.some((type) => eligibleOrgTypes.values.includes(type));
    const instrumentMatch = instruments.values.length === 0 || entity.acceptedInstruments.some((instrument) => instruments.values.includes(instrument));
    const dgrMatch = !requiredDgr || entity.attributes.includes('dgr_item_1') || entity.acceptedOrgTypes.includes('dgr');
    if (typeMatch && instrumentMatch && dgrMatch) {
      paths.push({
        entityId: entity.id,
        legalName: entity.legalName,
        typeMatch: eligibleOrgTypes.known ? 'confirmed' : 'unknown',
        instrumentMatch: instruments.values.length ? 'confirmed' : 'unknown',
      });
    }
  }
  return paths;
}

function findEngagedFunder(profile, candidate) {
  const haystack = normaliseFundingText([
    candidate.funderName,
    candidate.funder_name,
    candidate.provider,
    candidate.name,
  ].filter(Boolean).join(' '));
  for (const funder of profile.hardRules.alreadyEngagedFunders ?? []) {
    const aliases = [funder.name, ...(funder.aliases ?? [])];
    if (aliases.some((alias) => containsPhrase(haystack, alias))) return funder.name;
  }
  return null;
}

function evidenceCompleteness(candidate) {
  const supplied = finiteNumber(candidate.evidenceCompleteness ?? candidate.evidence_completeness);
  if (supplied !== null) return Math.max(0, Math.min(100, supplied));
  let known = 0;
  if (candidate.officialSourceConfirmed ?? candidate.official_source_confirmed) known += 1;
  if (String(candidate.name ?? '').trim()) known += 1;
  if (candidate.deadline || candidate.closes_at || candidate.intakeType === 'rolling' || candidate.intake_type === 'rolling') known += 1;
  if (array(candidate.eligibleOrgTypes ?? candidate.eligible_org_types).length) known += 1;
  if (finiteNumber(candidate.amountMin ?? candidate.amount_min) !== null || finiteNumber(candidate.amountMax ?? candidate.amount_max) !== null) known += 1;
  if (array(candidate.supportedCostTypes ?? candidate.supported_cost_types).length || array(candidate.fundingBlockIds ?? candidate.funding_block_ids).length) known += 1;
  if (candidate.ownershipGate || candidate.ownership_gate || typeof candidate.indigenousOwnershipRequired === 'boolean') known += 1;
  return Math.round((known / 7) * 100);
}

function qbeAssessment(profile, candidate, fit) {
  const accepted = new Set(profile.matchProgram.acceptedInstruments ?? []);
  const acceptedInstrument = fit.instruments.values.some((instrument) => accepted.has(instrument));
  const commitmentPossible = candidate.commitmentLetterPossible ?? candidate.commitment_letter_possible;
  const missingFields = array(candidate.commitmentLetterFields ?? candidate.commitment_letter_fields);
  const requiredFields = profile.matchProgram.commitmentLetterFields ?? [];
  const hasAllLetterFields = requiredFields.every((field) => missingFields.includes(field));

  if (fit.hardBlocks.length) {
    return { eligible: 'no', reasons: [`Blocked for GOODS: ${fit.hardBlocks.join(', ')}`] };
  }
  if (fit.instruments.values.length && !acceptedInstrument) {
    return { eligible: 'no', reasons: ['The instrument is outside the documented QBE match set.'] };
  }
  if (commitmentPossible === false) {
    return { eligible: 'no', reasons: ['The source says a named commitment cannot be provided by the decision deadline.'] };
  }
  if (commitmentPossible === true && hasAllLetterFields && acceptedInstrument) {
    return { eligible: 'yes', reasons: ['The candidate can provide the required amount, instrument, legal-name and contact commitment evidence.'] };
  }
  return {
    eligible: 'unclear',
    reasons: ['Fit is plausible, but the required commitment letter and decision timing are not yet verified.'],
  };
}

function makeReason(label, fit) {
  if (fit.hardBlocks.length) return `BLOCKED — ${fit.hardBlocks.join('; ')}.`;
  const blocks = fit.blockMatches.map((block) => block.label).join(', ') || 'no specific funding block yet';
  const entity = fit.entityPaths.map((path) => path.legalName).join(' or ') || 'entity path unverified';
  return `${label.replace(/_/g, ' ')} — ${blocks}; receiver: ${entity}.`;
}

export function assessProjectFundingFit(profile, candidate, options = {}) {
  const text = candidateText(candidate);
  const host = candidateHost(candidate);
  const instruments = inferredInstruments(candidate, text);
  const opportunityKind = inferredOpportunityKind(candidate, text, instruments.values);
  const eligibleOrgTypes = inferredEligibleOrgTypes(candidate, text);
  const ownershipGate = inferredOwnershipGate(candidate, text);
  const candidateMin = finiteNumber(candidate.amountMin ?? candidate.amount_min);
  const candidateMax = finiteNumber(candidate.amountMax ?? candidate.amount_max);
  const intakeType = normaliseFundingText(candidate.intakeType ?? candidate.intake_type ?? 'unknown').replace(/\s+/g, '_');
  const deadline = isoDate(candidate.deadline ?? candidate.closes_at);
  const asOf = new Date(options.asOf ?? profile.asOf ?? Date.now());
  const asOfDay = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const cutoff = new Date(`${profile.hardRules.deadlineOnOrBefore}T23:59:59.999Z`);
  const deadlineDate = deadline ? new Date(deadline) : null;
  const status = normaliseFundingText(candidate.status ?? candidate.applicationStatus ?? candidate.application_status);
  const entityPaths = eligibleEntityPaths(profile, eligibleOrgTypes, instruments, candidate);
  const matched = inferBlockMatches(profile, candidate);
  const pathIds = new Set(entityPaths.map((path) => path.entityId));
  const blockMatches = matched
    .filter((match) => pathIds.has(match.entityId) || !eligibleOrgTypes.known)
    .map((match) => {
      const block = profile.fundingNeed.blocks.find((item) => item.id === match.id);
      return { ...match, amountOverlap: amountOverlaps(candidateMin, candidateMax, block) };
    });

  const hardBlocks = [];
  const engagedFunder = findEngagedFunder(profile, candidate);
  if (engagedFunder) hardBlocks.push(`already engaged: ${engagedFunder}`);
  const excludedHost = (profile.hardRules.excludedHosts ?? []).find((rule) => hostMatches(host, rule));
  if (excludedHost) hardBlocks.push(`excluded source host: ${excludedHost}`);
  const source = normaliseFundingText(candidate.source ?? candidate.rawDb?.source ?? candidate.raw_database?.source);
  const excludedSource = (profile.hardRules.excludedSources ?? []).find((rule) => source === normaliseFundingText(rule));
  if (excludedSource) hardBlocks.push(`excluded source dataset: ${excludedSource}`);
  const funderText = normaliseFundingText([
    candidate.funderName,
    candidate.funder_name,
    candidate.provider,
  ].filter(Boolean).join(' '));
  const excludedFunderTerm = (profile.hardRules.excludedFunderTerms ?? []).find((term) => containsPhrase(funderText, term));
  if (excludedFunderTerm) hardBlocks.push(`excluded funder type: ${excludedFunderTerm}`);
  if ((profile.hardRules.excludedOpportunityKinds ?? []).includes(opportunityKind)) {
    hardBlocks.push(`excluded opportunity kind: ${opportunityKind}`);
  }
  if ((profile.hardRules.excludedAcademicTerms ?? []).some((term) => containsPhrase(text, term))) {
    hardBlocks.push('academic or individual-only funding');
  }
  if (profile.hardRules.blockIndigenousOwnershipGate && ownershipGate.required === true) {
    hardBlocks.push('Indigenous ownership/control is required');
  }
  if (CLOSED_STATUSES.has(status)) hardBlocks.push(`status is ${status}`);
  if (deadlineDate && deadlineDate.getTime() < asOfDay.getTime()) hardBlocks.push('deadline has passed');
  if (deadlineDate && deadlineDate.getTime() > cutoff.getTime()) hardBlocks.push(`deadline is after ${profile.hardRules.deadlineOnOrBefore}`);
  if (eligibleOrgTypes.known && entityPaths.length === 0) hardBlocks.push('no eligible GOODS entity or instrument path');

  const serviceException = blockMatches.some((block) => (profile.hardRules.smallGrantExceptionBlockIds ?? []).includes(block.id));
  if (candidateMax !== null && candidateMax < profile.hardRules.minimumCandidateAmount) {
    if (!serviceException || candidateMax < profile.hardRules.smallGrantMinimum) {
      hardBlocks.push(`maximum amount is below $${profile.hardRules.minimumCandidateAmount.toLocaleString('en-AU')}`);
    }
  }
  const maximumCandidateMinimum = finiteNumber(profile.hardRules.maximumCandidateMinimum);
  if (maximumCandidateMinimum !== null && candidateMin !== null && candidateMin > maximumCandidateMinimum) {
    hardBlocks.push(`minimum funding amount exceeds project need of $${maximumCandidateMinimum.toLocaleString('en-AU')}`);
  }

  const excludedCostText = normaliseFundingText(array(candidate.excludedCostTypes ?? candidate.excluded_cost_types).join(' '));
  const projectOnly = candidate.projectOnly === true || candidate.project_only === true || containsPhrase(text, 'project funding only');
  const excludesOperating = containsPhrase(excludedCostText, 'operating costs') || containsPhrase(excludedCostText, 'core costs');
  const excludesEquipment = containsPhrase(excludedCostText, 'equipment') || containsPhrase(excludedCostText, 'capital expenditure');
  if (projectOnly && excludesOperating && excludesEquipment) hardBlocks.push('project-only funding excludes operating and equipment costs');

  const themeHits = (profile.themes ?? []).filter((theme) => containsPhrase(text, theme));
  const candidateGeographies = geographyValues(candidate);
  const targetGeographies = (profile.geographies ?? []).map((value) => normaliseFundingText(String(value).replace(/^AU-/i, '')));
  const geographyMatch = candidateGeographies.length === 0
    ? 'unknown'
    : candidateGeographies.some((value) => value === 'au' || value === 'australia' || targetGeographies.includes(value))
      ? 'match'
      : 'mismatch';
  if (profile.hardRules.blockGeographyMismatch && geographyMatch === 'mismatch') {
    hardBlocks.push('geography is outside the GOODS delivery footprint');
  }
  const evidence = evidenceCompleteness(candidate);

  const bestBlockPriority = blockMatches.reduce((best, block) => Math.max(best, block.priority), 0);
  const blockScore = blockMatches.length
    ? Math.min(35, 10 + bestBlockPriority * 1.5 + Math.min(8, (blockMatches.length - 1) * 3) + (blockMatches.some((block) => block.hardestMoney) ? 4 : 0))
    : 0;
  const themeScore = Math.min(15, themeHits.length * 3);
  const geographyScore = geographyMatch === 'match' ? 5 : geographyMatch === 'unknown' ? 2 : 0;
  const entityScore = entityPaths.length ? (eligibleOrgTypes.known ? 10 : 5) : 0;
  const instrumentScore = instruments.values.length
    ? entityPaths.length ? 10 : 0
    : 5;
  const overlapValues = blockMatches.map((block) => block.amountOverlap).filter((value) => value !== null);
  const amountScore = overlapValues.includes(true) ? 10 : candidateMin === null && candidateMax === null ? 4 : 1;
  const timingScore = intakeType === 'rolling' || (deadlineDate && deadlineDate >= asOf && deadlineDate <= cutoff)
    ? 5
    : deadlineDate ? 0 : 2;
  const evidenceScore = evidence / 10;
  const rawScore = Math.round(blockScore + themeScore + geographyScore + entityScore + instrumentScore + amountScore + timingScore + evidenceScore);
  const score = hardBlocks.length ? 0 : Math.max(0, Math.min(100, rawScore));
  const label = hardBlocks.length
    ? 'blocked'
    : score >= 75
      ? 'strong_fit'
      : score >= 60
        ? 'good_fit'
        : score >= 40
          ? 'possible_fit'
          : 'weak_fit';

  const missingEvidence = [];
  if (!(candidate.officialSourceConfirmed ?? candidate.official_source_confirmed)) missingEvidence.push('official source');
  if (!deadline && intakeType !== 'rolling') missingEvidence.push('current timing');
  if (!eligibleOrgTypes.known) missingEvidence.push('applicant eligibility');
  if (candidateMin === null && candidateMax === null) missingEvidence.push('funding amount');
  if (ownershipGate.required === null) missingEvidence.push('ownership gate');
  if (!blockMatches.length) missingEvidence.push('fundable cost block');
  if ((candidate.commitmentLetterPossible ?? candidate.commitment_letter_possible) === undefined) missingEvidence.push('QBE commitment letter');

  const fit = {
    modelVersion: 'project-funding-fit-v1',
    profileVersion: profile.profileVersion,
    score,
    rawScore,
    label,
    opportunityKind,
    instruments,
    eligibleOrgTypes,
    ownershipGate,
    entityPaths,
    blockMatches,
    themeHits,
    geographyMatch,
    amount: { min: candidateMin, max: candidateMax },
    timing: { deadline, intakeType },
    evidenceCompleteness: evidence,
    missingEvidence,
    hardBlocks: unique(hardBlocks),
  };
  fit.qbe = qbeAssessment(profile, candidate, fit);
  fit.reason = makeReason(label, fit);
  return fit;
}

export function rankProjectFundingCandidates(profile, candidates, options = {}) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      fundingFit: assessProjectFundingFit(profile, candidate, options),
    }))
    .sort((left, right) => {
      const leftBlocked = left.fundingFit.hardBlocks.length ? 1 : 0;
      const rightBlocked = right.fundingFit.hardBlocks.length ? 1 : 0;
      return leftBlocked - rightBlocked
        || right.fundingFit.score - left.fundingFit.score
        || right.fundingFit.evidenceCompleteness - left.fundingFit.evidenceCompleteness
        || String(left.name ?? '').localeCompare(String(right.name ?? ''));
    });
}

export function selectCoveragePortfolio(profile, rankedCandidates, limit = 10, options = {}) {
  const minimumEvidence = Number.isFinite(Number(options.minEvidence)) ? Number(options.minEvidence) : 0;
  const remaining = rankedCandidates
    .filter((candidate) => candidate.fundingFit
      && candidate.fundingFit.hardBlocks.length === 0
      && candidate.fundingFit.score >= 40
      && (!options.requireOfficial || candidate.officialSourceConfirmed === true)
      && candidate.fundingFit.evidenceCompleteness >= minimumEvidence)
    .slice();
  const selected = [];
  const covered = new Map();
  const funders = new Set();

  while (remaining.length && selected.length < limit) {
    let bestIndex = -1;
    let bestValue = Number.NEGATIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const newCoverage = candidate.fundingFit.blockMatches.reduce((sum, block) => {
        const timesCovered = covered.get(block.id) ?? 0;
        const scarcity = timesCovered === 0 ? 1 : timesCovered === 1 ? 0.35 : 0;
        return sum + block.priority * scarcity + (block.hardestMoney && timesCovered === 0 ? 8 : 0);
      }, 0);
      const funderKey = normaliseFundingText(candidate.funderName ?? candidate.funder_name ?? candidate.provider ?? candidate.name);
      const diversityPenalty = funders.has(funderKey) ? 12 : 0;
      const value = candidate.fundingFit.score + newCoverage - diversityPenalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) break;
    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push({ ...chosen, portfolioValue: Math.round(bestValue) });
    const funderKey = normaliseFundingText(chosen.funderName ?? chosen.funder_name ?? chosen.provider ?? chosen.name);
    funders.add(funderKey);
    for (const block of chosen.fundingFit.blockMatches) covered.set(block.id, (covered.get(block.id) ?? 0) + 1);
  }

  return {
    selected,
    blockCoverage: profile.fundingNeed.blocks.map((block) => ({
      id: block.id,
      label: block.label,
      priority: block.priority,
      hardestMoney: Boolean(block.hardestMoney),
      candidateCount: covered.get(block.id) ?? 0,
    })),
  };
}
