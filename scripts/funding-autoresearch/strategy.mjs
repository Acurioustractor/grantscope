import {
  deliveryTrust,
  foundationRelationshipUtility,
  grantActability,
  hasCommunitySignal,
  hasIndigenousSignal,
  hasRegionalSignal,
  normalizeArray,
  overlapCount,
  stateMatches,
} from './lib/signals.mjs';

function confidenceTieBreak(candidate) {
  if (candidate.profileConfidence === 'high') return 2;
  if (candidate.profileConfidence === 'medium') return 1;
  return 0;
}

function futureGrantTieBreak(candidate) {
  if (!candidate.deadline) return 0;
  const then = Date.parse(candidate.deadline);
  if (Number.isNaN(then)) return 0;
  const days = Math.round((then - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return -2;
  if (days <= 45) return 2;
  if (days <= 180) return 1.5;
  if (days <= 365) return 1;
  return 0.5;
}

function specificityTieBreak(targets, values) {
  const candidateValues = normalizeArray(values);
  if (!candidateValues.length) return 0;
  const overlaps = overlapCount(targets, candidateValues);
  if (!overlaps) return 0;
  return overlaps / candidateValues.length;
}

function tieBreakerScore(scenario, candidate) {
  if (scenario.family === 'grant_discovery') {
    return (
      futureGrantTieBreak(candidate) +
      grantActability(candidate) * 0.25 +
      specificityTieBreak(scenario.target.themes, candidate.themes) * 2 +
      stateMatches(scenario.target.states, candidate.states) * 0.5
    );
  }

  if (scenario.family === 'foundation_discovery') {
    return (
      foundationRelationshipUtility(candidate) * 0.5 +
      confidenceTieBreak(candidate) +
      specificityTieBreak(scenario.target.themes, candidate.themes) * 2 +
      specificityTieBreak(scenario.target.beneficiaries, candidate.beneficiaries) * 1.5 +
      (scenario.target.preferRegional && hasRegionalSignal(candidate) ? 1 : 0)
    );
  }

  if (scenario.family === 'charity_delivery_match') {
    return (
      deliveryTrust(candidate) * 0.5 +
      specificityTieBreak(scenario.target.themes, candidate.purposes) * 2 +
      specificityTieBreak(scenario.target.beneficiaries, candidate.beneficiaries) * 1.5 +
      (scenario.target.preferRegional && hasRegionalSignal(candidate) ? 1 : 0)
    );
  }

  if (scenario.family === 'social_enterprise_delivery_match') {
    return (
      deliveryTrust(candidate) * 0.5 +
      confidenceTieBreak(candidate) +
      specificityTieBreak(scenario.target.themes, candidate.sectors) * 2 +
      specificityTieBreak(scenario.target.beneficiaries, candidate.beneficiaries) * 1.5 +
      (scenario.target.preferRegional && hasRegionalSignal(candidate) ? 1 : 0)
    );
  }

  return (
    (candidate.totalFunding === 0 ? 1 : 0) +
    (candidate.seifaDecile && candidate.seifaDecile <= 3 ? 1 : 0) +
    (hasRegionalSignal(candidate) ? 1 : 0)
  );
}

function scoreGrantScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.themes) * 5;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 2;
  score += grantActability(candidate) * 1.5;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  if (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)) score += 1.5;
  return score;
}

function scoreFoundationScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.themes) * 5;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 2;
  score += foundationRelationshipUtility(candidate) * 1.5;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  return score;
}

function scoreCharityScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.purposes) * 4;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 3;
  score += stateMatches(scenario.target.states, candidate.states) * 2;
  score += deliveryTrust(candidate) * 1.25;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 2.5;
  if (scenario.target.preferRegional && hasRegionalSignal(candidate)) score += 1.5;
  return score;
}

function scoreSocialEnterpriseScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.sectors) * 4;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 2;
  score += stateMatches(scenario.target.states, candidate.states) * 2;
  score += deliveryTrust(candidate);
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  return score;
}

function scorePlaceScenario(scenario, candidate) {
  let score = 0;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  if (scenario.target.needFirst) score += 4;
  if (candidate.totalFunding === 0) score += 3;
  if (candidate.seifaDecile && candidate.seifaDecile <= 3) score += 3;
  if (hasRegionalSignal(candidate)) score += 2;
  if (candidate.entityCount && candidate.entityCount > 0) score += 1;
  return score;
}

export function rankScenario(scenario) {
  const scoreCandidate = (candidate) => {
    if (scenario.family === 'grant_discovery') return scoreGrantScenario(scenario, candidate);
    if (scenario.family === 'foundation_discovery') return scoreFoundationScenario(scenario, candidate);
    if (scenario.family === 'charity_delivery_match') return scoreCharityScenario(scenario, candidate);
    if (scenario.family === 'social_enterprise_delivery_match') return scoreSocialEnterpriseScenario(scenario, candidate);
    return scorePlaceScenario(scenario, candidate);
  };

  return scenario.candidatePool
    .map((candidate) => ({
      ...candidate,
      strategyScore: scoreCandidate(candidate),
      tieBreakerScore: tieBreakerScore(scenario, candidate),
    }))
    .sort(
      (a, b) =>
        b.strategyScore - a.strategyScore ||
        b.tieBreakerScore - a.tieBreakerScore ||
        String(a.name || a.postcode).localeCompare(String(b.name || b.postcode)),
    );
}
