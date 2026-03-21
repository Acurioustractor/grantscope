#!/usr/bin/env node
/**
 * ingest-charter-letters.mjs
 *
 * Ingests Premier Crisafulli's ministerial charter letters (8 Nov 2024)
 * into civic_charter_commitments table.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-charter-letters.mjs
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Charter data extracted from PDFs ─────────────────────────────

const CHARTER_DATE = '2024-11-08';

const MINISTERS = [
  // ── Laura Gerber — Youth Justice + Corrective Services ──
  {
    minister: 'Laura Gerber',
    portfolio: 'Minister for Youth Justice and Victim Support and Minister for Corrective Services',
    department: 'Department of Youth Justice and Victim Support; Queensland Corrective Services',
    values: [
      { text: 'Be one of four ministers charged with reducing victim of crime numbers in Queensland', category: 'youth_justice', yj: true },
      { text: 'Deliver laws that match community expectations for young people committing serious crime', category: 'youth_justice', yj: true },
      { text: 'Maintain a strong focus on early intervention and rehabilitation measures for juveniles across the portfolio', category: 'youth_justice', yj: true },
      { text: 'Work collaboratively with the non-government sector to provide the highest standard of programs for at-risk young people', category: 'youth_justice', yj: true },
      { text: 'Ensure consequences for offending, a focus on early intervention and rehabilitation, and victims are prioritised in all your work', category: 'youth_justice', yj: true },
      { text: 'Ensure that victims of crime from across Queensland are appropriately and proactively supported with the upmost support and humanity', category: 'victim_support', yj: false },
      { text: 'Ensure that correctional facilities are a safe place for staff', category: 'corrective_services', yj: false },
      { text: 'Create an environment where correctional facilities are a place where reform can occur for the perpetrators of crime', category: 'corrective_services', yj: false },
    ],
    deliverables: [
      { text: 'Pass the Making Queensland Safer Laws through Parliament, including Adult Crime Adult Time, putting victims front and centre, and removing detention as a last resort', category: 'youth_justice', yj: true },
      { text: 'Establish the expert legal panel to review future stages of Adult Crime, Adult Time', category: 'youth_justice', yj: true },
      { text: 'Ensure regions across Queensland are appropriately resourced with gold standard early intervention and rehabilitation programs to reduce offending that targets the needs of communities', category: 'youth_justice', yj: true },
      { text: 'Work with the Minister for Education and the Arts to rollout Crime Prevention and Youth Justice Schools across the State', category: 'youth_justice', yj: true },
      { text: 'Increase transparency of reporting on youth justice', category: 'youth_justice', yj: true },
      { text: 'Ensure the effective establishment and delivery of Regional Reset programs across Queensland', category: 'youth_justice', yj: true },
      { text: 'Go to market for Circuit Breaker Sentencing proposals to ensure we have two secure, remote and effective centres which provide an alternate to detention and strong focus on rehabilitation', category: 'youth_justice', yj: true },
      { text: 'Work with ministerial colleagues and the non-government sector to establish and deliver Staying on Track, the 12-month rehabilitation program for young people leaving detention', category: 'youth_justice', yj: true },
      { text: 'Work with the Minister for Education and the Arts to increase school attendance in youth detention', category: 'youth_justice', yj: true },
      { text: 'Work with the Minister for Police and Emergency Services to reduce the number of young people in watch houses', category: 'youth_justice', yj: true },
      { text: 'Work with relevant stakeholders to reform youth detention centres with focus on discipline and rehabilitation', category: 'youth_justice', yj: true },
      { text: 'Consult with the sector to determine appropriate separation periods following staff assaults in youth detention centres', category: 'youth_justice', yj: true },
      { text: 'Consult widely and effectively with the Cairns community in choosing the location and design of the new youth detention centre', category: 'youth_justice', yj: true },
      { text: 'Design and deliver a professional victim advocacy service for victims of crime in Queensland', category: 'victim_support', yj: false },
      { text: 'Manage and plan corrective centre capacity to meet demand now and over the coming decade', category: 'corrective_services', yj: false },
      { text: 'Deliver a pilot program to put GPS ankle bracelet tracking on high-risk offenders of domestic and family violence (with Minister Camm)', category: 'corrective_services', yj: false },
      { text: 'Provide Corrective Service Officers with the operational equipment they need to safely perform their duties', category: 'corrective_services', yj: false },
      { text: 'Ensure the efficient and effective operation of the Parole Board Queensland', category: 'corrective_services', yj: false },
      { text: 'Create a safe environment for staff in correctional facilities', category: 'corrective_services', yj: false },
    ],
  },

  // ── John-Paul Langbroek — Education ──
  {
    minister: 'John-Paul Langbroek',
    portfolio: 'Minister for Education and the Arts',
    department: 'Department of Education',
    values: [
      { text: 'Empower principals, teachers and school communities to deliver improved educational outcomes for Queensland children', category: 'education', yj: false },
      { text: 'Ensure schools are adequately resourced and empowered to maintain strong behavioural standards', category: 'education', yj: false },
    ],
    deliverables: [
      { text: 'Work with the Minister for Youth Justice to rollout the promised Crime Prevention and Youth Justice Schools', category: 'youth_justice', yj: true },
      { text: 'Increase the attendance rates and educational outcomes for Aboriginal students and Torres Strait Islander students across Queensland', category: 'education', yj: true },
      { text: 'Work with the Minister for Youth Justice and Minister for Corrective Services to increase school attendance in youth detention', category: 'youth_justice', yj: true },
      { text: 'Ensure young people at risk of disengagement from education are effectively supported and re-engaged in education, training or employment', category: 'education', yj: true },
      { text: 'Effectively deliver Respectful Relationships Education across Queensland with effective reporting mechanisms', category: 'education', yj: false },
      { text: 'Introduce a zero-tolerance policy for violence, vapes and drugs in our schools', category: 'education', yj: false },
      { text: 'Support the recruitment of 550 more teacher aides', category: 'education', yj: false },
      { text: 'Deliver the Healthy Kindy Kids program', category: 'education', yj: false },
    ],
  },

  // ── Sam O'Connor — Housing + Youth ──
  {
    minister: "Sam O'Connor",
    portfolio: 'Minister for Housing and Public Works and Minister for Youth',
    department: 'Department of Housing and Public Works',
    values: [
      { text: 'Increase housing supply and options for vulnerable Queenslanders', category: 'housing', yj: false },
      { text: 'Unlock the Community Housing Sector across Queensland', category: 'housing', yj: false },
      { text: 'Identify and activate opportunities for young Queenslanders to contribute to the ongoing prosperity of our state', category: 'youth', yj: true },
      { text: 'Foster a night-time economy that is safe and vibrant across Queensland', category: 'youth', yj: false },
    ],
    deliverables: [
      { text: "Implement the Government's 'Securing our Housing Foundations' Plan — one million new homes by 2044, including 53,500 social and community housing dwellings", category: 'housing', yj: false },
      { text: 'Deliver a Master Agreement for Community Housing Providers in Queensland', category: 'housing', yj: false },
      { text: 'Play an active and engaged role in Queensland\'s Youth Parliament forums to ensure young Queenslanders\' voices are heard', category: 'youth', yj: true },
      { text: 'Investigate and activate opportunities to better allow for young Queenslanders to be consulted and informed on work undertaken by the Queensland Government', category: 'youth', yj: true },
      { text: 'Work to deliver 10 new or replaced domestic and family violence shelters for vulnerable women and children', category: 'housing', yj: false },
      { text: 'Deliver ongoing funding uplift for specialist homelessness services across the forward estimates', category: 'housing', yj: false },
    ],
  },

  // ── Amanda Camm — Families, Child Safety, DFV ──
  {
    minister: 'Amanda Camm',
    portfolio: 'Minister for Families, Seniors and Disability Services and Minister for Child Safety and the Prevention of Domestic and Family Violence',
    department: 'Department of Families, Seniors, Disability Services and Child Safety',
    values: [
      { text: 'Focus on Queenslanders being safe in their homes', category: 'child_safety', yj: false },
      { text: 'Be one of four ministers charged with reducing victim of crime numbers in Queensland', category: 'child_safety', yj: true },
      { text: 'Direct resources to the frontline to improve outcomes for at-risk children in Queensland', category: 'child_safety', yj: true },
    ],
    deliverables: [
      { text: 'Deliver a pilot program to put GPS ankle bracelet tracking on high-risk offenders of domestic and family violence (with Minister Gerber)', category: 'child_safety', yj: false },
      { text: "Deliver the 'Safer Children, Safer Communities' Plan to protect our State's most vulnerable children and prevent them falling into crime", category: 'child_safety', yj: true },
      { text: 'Increase Child Safety Officer numbers by 20 per cent by 2030', category: 'child_safety', yj: true },
      { text: "Design and develop Queensland's first Secure Care facility", category: 'child_safety', yj: true },
      { text: 'Work with the Minister for Youth Justice and Minister for Corrective Services to reduce the number of young people in care interacting with the criminal justice system', category: 'youth_justice', yj: true },
      { text: 'Work with Beyond DV to identify and establish Hope Hubs in strategic positions across the State', category: 'child_safety', yj: false },
      { text: 'Ensure the introduction of Coercive Control as a criminal offence is complemented by comprehensive community and stakeholder education', category: 'child_safety', yj: false },
      { text: 'Implement outstanding recommendations from the Royal Commission into Institutional Responses to Child Sexual Abuse', category: 'child_safety', yj: false },
    ],
  },

  // ── Fiona Simpson — Women, Aboriginal, Multiculturalism ──
  {
    minister: 'Fiona Simpson',
    portfolio: 'Minister for Women and Women\'s Economic Security, Minister for Aboriginal and Torres Strait Islander Partnerships and Minister for Multiculturalism',
    department: 'Department of Women, Aboriginal and Torres Strait Islander Partnerships and Multiculturalism',
    values: [
      { text: 'Lift living standards in Aboriginal communities and Torres Strait Islander communities, particularly discrete First Nations communities', category: 'aboriginal', yj: true },
      { text: 'Work closely with other agencies to improve health, educational and employment outcomes', category: 'aboriginal', yj: true },
    ],
    deliverables: [
      { text: 'Support the development of policies and fund programs to boost health and education standards for First Nations Queenslanders', category: 'aboriginal', yj: true },
      { text: 'Ensure funding for Path to Treaty is redirected to measurable action for First Nations peoples', category: 'aboriginal', yj: true },
      { text: 'Work with the Minister for Youth Justice and Minister for Corrective Services and Minister for Police to ensure appropriate and effective early intervention and rehabilitation programs are put in place to reduce the rates of young First Nations people offending', category: 'youth_justice', yj: true },
      { text: 'Work towards the objectives of the National Agreement on Closing the Gap, prioritising health, housing and education outcomes', category: 'aboriginal', yj: true },
      { text: 'Invest $1.5 million into the Ethnic Communities Council of Queensland', category: 'multiculturalism', yj: false },
      { text: "Build Queensland's first Chinese Culture and Heritage Centre for Cairns", category: 'multiculturalism', yj: false },
    ],
  },
];

// ── Ingest ──

async function main() {
  log('Ingesting ministerial charter letters...');

  let total = 0;
  let inserted = 0;

  for (const m of MINISTERS) {
    // Values
    for (const v of m.values) {
      const record = {
        minister_name: m.minister,
        portfolio: m.portfolio,
        department: m.department,
        commitment_type: 'value',
        commitment_text: v.text,
        category: v.category,
        youth_justice_relevant: v.yj,
        charter_date: CHARTER_DATE,
        source_document: `Premier Charter Letter to ${m.minister} (8 Nov 2024)`,
      };

      const { error } = await db
        .from('civic_charter_commitments')
        .insert(record);

      total++;
      if (error) {
        log(`  Error: ${error.message}`);
      } else {
        inserted++;
      }
    }

    // Deliverables
    for (const d of m.deliverables) {
      const record = {
        minister_name: m.minister,
        portfolio: m.portfolio,
        department: m.department,
        commitment_type: 'deliverable',
        commitment_text: d.text,
        category: d.category,
        youth_justice_relevant: d.yj,
        charter_date: CHARTER_DATE,
        source_document: `Premier Charter Letter to ${m.minister} (8 Nov 2024)`,
      };

      const { error } = await db
        .from('civic_charter_commitments')
        .insert(record);

      total++;
      if (error) {
        log(`  Error: ${error.message}`);
      } else {
        inserted++;
      }
    }

    log(`  ${m.minister}: ${m.values.length} values + ${m.deliverables.length} deliverables`);
  }

  log(`\nDone. Inserted ${inserted}/${total} commitments.`);

  // Summary
  const { data: yjCount } = await db
    .from('civic_charter_commitments')
    .select('id', { count: 'exact', head: true })
    .eq('youth_justice_relevant', true);

  log(`Youth justice relevant commitments: ${yjCount}`);
}

main();
