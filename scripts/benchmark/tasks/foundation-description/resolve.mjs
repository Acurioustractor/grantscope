/**
 * resolve.mjs — Foundation Description Generator (MUTABLE)
 *
 * Generates a 2-4 sentence description of a foundation from structured data.
 * This is the file that the autoresearch loop improves.
 *
 * VERSION: 1 — Baseline template-based generation
 */

/**
 * Generate a foundation description from available data.
 *
 * @param {Object} foundation - Foundation data
 * @param {string} foundation.canonical_name - Foundation name
 * @param {string} foundation.abn - ABN
 * @param {Object} foundation.acnc - ACNC financial data
 * @param {string[]} foundation.grant_programs - List of grant program categories
 * @param {string} foundation.state - State code
 * @returns {{ description: string, confidence: string, method: string }}
 */
export function resolve(foundation) {
  const { canonical_name, acnc, grant_programs, state } = foundation;

  const parts = [];

  // Opening — what it is
  const name = canonical_name.replace(/\b(Ltd|Limited|Inc|Foundation)\b\.?/gi, '').trim();
  parts.push(`${canonical_name} is a`);

  // Scale
  if (acnc?.charity_size) {
    parts[0] += ` ${acnc.charity_size.toLowerCase()}-sized`;
  }

  // Type + location
  parts[0] += ` philanthropic foundation`;
  if (state) {
    parts[0] += ` based in ${stateLabel(state)}`;
  }
  parts[0] += '.';

  // Focus areas from grant programs
  if (grant_programs?.length > 0) {
    const areas = grant_programs.slice(0, 5);
    if (areas.length === 1) {
      parts.push(`It focuses on ${areas[0].toLowerCase()}.`);
    } else {
      const last = areas.pop();
      parts.push(`It supports ${areas.map(a => a.toLowerCase()).join(', ')} and ${last.toLowerCase()}.`);
    }
  }

  // Scale details
  if (acnc?.total_assets && acnc.total_assets > 0) {
    const assets = formatScale(acnc.total_assets);
    if (acnc.total_revenue && acnc.total_revenue > 0) {
      const revenue = formatScale(acnc.total_revenue);
      parts.push(`The foundation manages ${assets} in assets and distributes approximately ${revenue} annually.`);
    } else {
      parts.push(`The foundation manages ${assets} in assets.`);
    }
  }

  // Staff
  if (acnc?.staff_fte && acnc.staff_fte > 10) {
    parts.push(`It employs ${acnc.staff_fte} staff.`);
  }

  // Cap at 4 sentences
  const description = parts.slice(0, 4).join(' ');

  return {
    description,
    confidence: grant_programs?.length > 0 ? 'medium' : 'low',
    method: 'template_v1',
  };
}

function stateLabel(code) {
  const labels = {
    NSW: 'New South Wales',
    VIC: 'Victoria',
    QLD: 'Queensland',
    WA: 'Western Australia',
    SA: 'South Australia',
    TAS: 'Tasmania',
    ACT: 'the Australian Capital Territory',
    NT: 'the Northern Territory',
  };
  return labels[code] || code;
}

function formatScale(amount) {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)} billion`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)} million`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)},000`;
  return `$${amount.toLocaleString()}`;
}
