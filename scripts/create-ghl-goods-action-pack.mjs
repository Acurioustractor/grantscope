#!/usr/bin/env node
/**
 * Create the QBE-critical Goods action pack as idempotent HighLevel tasks.
 *
 * Tasks attach to verified relationship contacts. Existing opportunity owners
 * are reused when available. Synthetic demand contacts are deliberately
 * excluded.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
if (!KEY) throw new Error('Missing GHL_API_KEY');

const ACTIONS = [
  {
    lane: 'grant',
    opportunityId: 'jzsCRxwr17oswxNNW8qh',
    contactId: 'u8Hii2zoM7bUPwDAoicQ',
    title: '[Goods] ANZ Seeds: make go/no-go decision and submit',
    dueDate: '2026-07-29T09:00:00+10:00',
    body: 'Confirm an eligible rural community applicant or auspice and a tightly scoped project. If viable, submit by 30 July 2026 at 5pm AEST; otherwise park it rather than lodge a weak application.',
  },
  {
    lane: 'grant',
    opportunityId: 'rIYE007OMlkMXUisaTz6',
    contactId: 'UfZV6ETpVRVSyqZxIz3w',
    title: '[Goods] Sisters of Charity: make EOI go/no-go decision',
    dueDate: '2026-07-29T10:00:00+10:00',
    body: 'Confirm eligible applicant, community partner and program fit. If viable, submit the EOI by 31 July 2026 at 5pm AEST.',
  },
  {
    lane: 'grant',
    opportunityId: 'Wx35axGV7phZbXvtKIbn',
    contactId: 'XKfO7huCETKk4t81mNqo',
    title: '[Goods] SEDI: start 2026-27 capability grant EOI',
    dueDate: '2026-07-31T09:00:00+10:00',
    body: 'Confirm applicant entity and social-enterprise eligibility. Scope up to $120k around financial modelling, contract readiness, impact measurement and investment readiness. Applications are assessed as received until funds are exhausted.',
  },
  {
    lane: 'grant',
    opportunityId: 'eJYnkLDTTVtHU34DxLsq',
    contactId: 'Llzo4tKCAFuM8j7YtaAf',
    title: '[Goods] Clean Energy Advice: confirm applicant and project eligibility',
    dueDate: '2026-07-31T10:00:00+10:00',
    body: 'Confirm a First Nations applicant or auspice and a genuine clean-energy development opportunity. Obtain an advisor scope and quote, then submit early because the demand-driven round may close before 3 September.',
  },
  {
    lane: 'supporter',
    opportunityId: 'f8CVsp8afeeuqnSsHBUM',
    contactId: 'lDj2R6MytUQZt7UA1JLq',
    title: '[Goods] QBE: confirm hackathon challenge and required commitment evidence',
    dueDate: '2026-08-03T09:00:00+10:00',
    body: 'Confirm the final 11 August challenge with Adam/SIH and the exact evidence QBE participants can help produce: named institutional pathways, commitment format, owner and next meeting.',
  },
  {
    lane: 'supporter',
    opportunityId: 'ZzPJCLAq3nkAo0bG7ot3',
    contactId: 'NSn2Ywjd0g0RIlWp66Fs',
    title: '[Goods] Snow: ask for first-mover commitment pathway',
    dueDate: '2026-08-04T09:00:00+10:00',
    body: 'Confirm whether Snow can provide an LOI, matched-capital signal or written first-mover statement before the QBE session. Record amount, conditions, decision-maker and date.',
  },
  {
    lane: 'supporter',
    opportunityId: 'KZSUEe89wSm1vMLYMUr8',
    contactId: 'ehnCEv62bCaGNTd1QuGp',
    title: '[Goods] Centrecorp: confirm board outcome and split buyer/funder pathway',
    dueDate: '2026-08-03T09:00:00+10:00',
    body: 'Confirm the 130-bed board outcome, procurement timing and whether Centrecorp can provide a buyer LOI, funding commitment or separate documents for each pathway.',
  },
  {
    lane: 'supporter',
    opportunityId: 'zQZWXJyILdvzwm8OACPr',
    contactId: 'bkZQ6vDNekvTtUVV1TpI',
    title: '[Goods] Minderoo: test QBE-aligned catalytic funding appetite',
    dueDate: '2026-08-06T09:00:00+10:00',
    body: 'Send or discuss the concise QBE-aligned case. Confirm fit, decision pathway, likely amount range, required evidence and the next decision date.',
  },
  {
    lane: 'supporter',
    opportunityId: 'hBRVkCMhT93215aqTRRr',
    contactId: 'QP8M4iLfBOfs66V81jiX',
    title: '[Goods] SEFA: confirm repayable finance structure and readiness gaps',
    dueDate: '2026-08-06T09:00:00+10:00',
    body: 'Confirm suitable facility type, indicative amount, security/repayment requirements, trading-entity requirements and what must be ready after QBE.',
  },
  {
    lane: 'buyer',
    opportunityId: 'TUpPBR3c76JeuksojRz1',
    contactId: 'ehnCEv62bCaGNTd1QuGp',
    title: '[Goods] Centrecorp buyer: validate 130-bed order and next procurement step',
    dueDate: '2026-08-03T09:00:00+10:00',
    body: 'Validate quantity, unit specification, delivery locations, budget owner, procurement mechanism and target order date. Capture the buyer-side LOI separately from any grant support.',
  },
  {
    lane: 'buyer',
    opportunityId: '49tvaOJvcQFzqf4arXfl',
    contactId: 'FVfAK0x3SjtTkBmPBTxI',
    title: '[Goods] WHSAC: re-open with Simone and validate Groote demand',
    dueDate: '2026-08-05T09:00:00+10:00',
    body: 'Follow up the existing Goods thread. Validate products, quantities, communities, budget pathway and whether the current $1.7m opportunity value is supported or should be revised.',
  },
  {
    lane: 'buyer',
    opportunityId: 'YVLVRFFkag7r3i1PgUIy',
    contactId: 'mmLzQtTJEMJE0KAiDTTO',
    title: '[Goods] NPY: validate 200–350 bed standing demand and LOI route',
    dueDate: '2026-08-05T09:00:00+10:00',
    body: 'Confirm current demand range, locations, delivery cadence, procurement authority and whether NPY can document standing demand or provide an LOI for QBE.',
  },
  {
    lane: 'buyer',
    opportunityId: 'iIWtDgWZLKAUXH6lwPpq',
    contactId: 'ef3tYp3HPNOmUNeu05gc',
    title: '[Goods] Miwatj: confirm clinic demand and purchasing pathway',
    dueDate: '2026-08-07T09:00:00+10:00',
    body: 'Confirm clinic/community scope, beds versus washing machines, quantities, budget holder, purchasing route and the next decision meeting.',
  },
  {
    lane: 'buyer',
    opportunityId: 'sT7MOE1aCt2ywomCcg2l',
    contactId: 'bJ0IHYKRVBtlwmyIydaQ',
    title: '[Goods] Anyinginyi: confirm $4.8k scope and decision date',
    dueDate: '2026-08-07T09:00:00+10:00',
    body: 'Validate what the current $4.8k represents, required products/quantities, delivery location, purchaser and the next commitment step.',
  },
];

async function ghl(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const taskCache = new Map();
async function tasksFor(contactId) {
  if (!taskCache.has(contactId)) {
    const data = await ghl(`/contacts/${contactId}/tasks`);
    taskCache.set(contactId, data.tasks || []);
  }
  return taskCache.get(contactId);
}

const results = [];
for (const action of ACTIONS) {
  const [tasks, opportunityData] = await Promise.all([
    tasksFor(action.contactId),
    ghl(`/opportunities/${action.opportunityId}`),
  ]);
  const existing = tasks.find((task) => task.title === action.title);
  if (existing) {
    results.push({ lane: action.lane, title: action.title, action: 'already-exists', taskId: existing.id });
    continue;
  }
  const opportunity = opportunityData.opportunity || opportunityData;
  const payload = {
    title: action.title,
    body: action.body,
    dueDate: action.dueDate,
    completed: false,
    ...(typeof opportunity.assignedTo === 'string' && opportunity.assignedTo
      ? { assignedTo: opportunity.assignedTo }
      : {}),
  };
  if (APPLY) {
    const created = await ghl(`/contacts/${action.contactId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    results.push({
      lane: action.lane,
      title: action.title,
      action: 'created',
      taskId: created.task?.id || created.id || null,
      dueDate: action.dueDate,
    });
  } else {
    results.push({ lane: action.lane, title: action.title, action: 'would-create', dueDate: action.dueDate });
  }
}

console.log(JSON.stringify({
  apply: APPLY,
  considered: ACTIONS.length,
  created: results.filter((row) => row.action === 'created').length,
  existing: results.filter((row) => row.action === 'already-exists').length,
  results,
}, null, 2));
