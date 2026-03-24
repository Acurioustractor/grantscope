-- Seed policy_events and oversight_recommendations for child-protection, disability, education
-- Safe: uses ON CONFLICT DO NOTHING via unique composite check before insert

-- =============================================
-- CHILD PROTECTION — Policy Events
-- =============================================

INSERT INTO policy_events (jurisdiction, domain, event_date, title, description, event_type, severity, source, source_url)
VALUES
-- National
('National', 'child-protection', '2009-04-30', 'National Framework for Protecting Australia''s Children', 'First national plan — Protecting Children is Everyone''s Business 2009-2020. Established six outcome areas and 12-year reform agenda.', 'framework', 'significant', 'DSS', 'https://www.dss.gov.au/families-and-children/protecting-australias-children'),
('National', 'child-protection', '2021-12-10', 'Safe and Supported: National Framework 2021-2031', 'Successor to 2009 framework. Four focus areas: prevention, First Nations, OOHC reform, information sharing. First 5-year action plan 2023-2028.', 'framework', 'significant', 'DSS', 'https://www.dss.gov.au/safe-and-supported'),
('National', 'child-protection', '2017-10-15', 'Royal Commission into Institutional Responses to Child Sexual Abuse — Final Report', 'Five years, 57,000+ calls, 8,000+ private sessions. 409 recommendations across institutions, redress, criminal justice, child safe standards.', 'report', 'critical', 'Royal Commission', 'https://www.childabuseroyalcommission.gov.au/final-report'),
('National', 'child-protection', '2018-11-01', 'National Redress Scheme commences', 'Established under National Redress Scheme for Institutional Child Sexual Abuse Act 2018. Counselling, direct personal response, and monetary payments up to $150,000.', 'legislation', 'significant', 'DSS', NULL),
('National', 'child-protection', '2022-02-01', 'National Principles for Child Safe Organisations', 'All jurisdictions commit to implementing 10 Child Safe Standards based on Royal Commission recommendations.', 'framework', 'moderate', 'National Office for Child Safety', NULL),

-- QLD
('QLD', 'child-protection', '2013-07-01', 'Carmody Inquiry — Taking Responsibility report', 'Queensland Child Protection Commission of Inquiry. 121 recommendations — shift from tertiary intervention to prevention and early intervention.', 'inquiry', 'critical', 'QLD Government', NULL),
('QLD', 'child-protection', '2014-01-01', 'Child Protection Reform Amendment Act 2014', 'Implements Carmody reforms. New permanency framework, strengthen family-based care, reduce entries to OOHC.', 'legislation', 'significant', 'QLD Parliament', NULL),
('QLD', 'child-protection', '2024-06-30', 'QLD Budget 2024-25: $1.4B child safety', 'Record investment in child safety including 300 additional frontline staff over 4 years.', 'budget', 'significant', 'QLD Treasury', NULL),

-- NSW
('NSW', 'child-protection', '2008-11-24', 'Wood Special Commission of Inquiry', 'Inquiry into child protection services in NSW. Led to creation of Keep Them Safe reforms and restructure of Department of Community Services.', 'inquiry', 'critical', 'NSW Government', NULL),
('NSW', 'child-protection', '2014-03-01', 'Strengthening families, protecting children', 'NSW child protection legislative reform package. Permanency planning, adoption, guardianship orders.', 'legislation', 'significant', 'NSW Parliament', NULL),
('NSW', 'child-protection', '2019-11-01', 'Family is Culture Review', 'Independent review of Aboriginal children in OOHC. 125 recommendations including restructuring DCJ. Found systemic failures for Aboriginal families.', 'report', 'critical', 'Professor Megan Davis', NULL),

-- VIC
('VIC', 'child-protection', '2012-11-13', 'Betrayal of Trust Inquiry — Final Report', 'Victorian parliamentary inquiry into child abuse in religious and other organisations. Led to mandatory reporting expansion.', 'inquiry', 'critical', 'VIC Parliament', NULL),
('VIC', 'child-protection', '2016-04-01', 'Roadmap for Reform: Strong Families, Safe Children', 'Victorian child protection reform program. Focus on Aboriginal self-determination, early intervention, therapeutic residential care.', 'framework', 'significant', 'DFFH', NULL),
('VIC', 'child-protection', '2023-07-01', 'Child Protection workforce uplift', 'Additional 180 child protection practitioners funded across Victoria. Part of broader workforce strategy.', 'budget', 'moderate', 'DFS', NULL),

-- NT
('NT', 'child-protection', '2010-06-30', 'Growing them strong, together (Bath Report)', 'Board of Inquiry into child protection system in NT. 147 recommendations. Found system in crisis.', 'inquiry', 'critical', 'NT Government', NULL),
('NT', 'child-protection', '2017-11-17', 'Royal Commission into Detention and Protection of Children in NT', 'Focused on Don Dale and child protection. 227 recommendations including raising age of criminal responsibility.', 'report', 'critical', 'Royal Commission', 'https://www.royalcommission.gov.au/child-detention'),

-- WA
('WA', 'child-protection', '2017-06-01', 'Earlier Intervention and Family Support Strategy', 'WA reform to shift from crisis response to prevention. Includes Target 120 (high-risk youth) and Family Support Networks.', 'framework', 'moderate', 'WA CPFS', NULL),

-- SA
('SA', 'child-protection', '2016-08-01', 'Nyland Royal Commission — The Life They Deserve', 'Royal Commission into child protection systems in SA following death of Chloe Valentine. 260 recommendations.', 'inquiry', 'critical', 'SA Government', NULL),
('SA', 'child-protection', '2023-01-01', 'Children and Young People (Safety) Act reforms', 'Amendments strengthening Aboriginal and Torres Strait Islander Child Placement Principle compliance.', 'amendment', 'moderate', 'SA Parliament', NULL),

-- TAS
('TAS', 'child-protection', '2023-10-01', 'Commission of Inquiry into Government Responses to Child Sexual Abuse', 'Tasmania''s first commission examining institutional responses. Interim reports found systemic failures in government agencies.', 'inquiry', 'critical', 'TAS Government', NULL)
ON CONFLICT DO NOTHING;


-- =============================================
-- CHILD PROTECTION — Oversight Recommendations
-- =============================================

INSERT INTO oversight_recommendations (jurisdiction, domain, oversight_body, report_title, report_date, recommendation_number, recommendation_text, status, severity, target_department)
VALUES
('National', 'child-protection', 'Royal Commission IRCS', 'Final Report', '2017-12-15', 'RC-CP-1', 'Establish National Office for Child Safety to coordinate cross-jurisdictional child safe standards', 'implemented', 'critical', 'DSS'),
('National', 'child-protection', 'Royal Commission IRCS', 'Final Report', '2017-12-15', 'RC-CP-2', 'All institutions working with children must implement the 10 Child Safe Standards', 'partially_implemented', 'critical', 'All jurisdictions'),
('National', 'child-protection', 'Royal Commission IRCS', 'Final Report', '2017-12-15', 'RC-CP-3', 'Establish National Redress Scheme for survivors of institutional child sexual abuse', 'implemented', 'critical', 'DSS'),
('QLD', 'child-protection', 'Carmody Inquiry', 'Taking Responsibility', '2013-07-01', 'CARM-1', 'Shift investment from tertiary to secondary and primary prevention services', 'partially_implemented', 'critical', 'DCSSDS'),
('QLD', 'child-protection', 'Carmody Inquiry', 'Taking Responsibility', '2013-07-01', 'CARM-2', 'Implement differential response model to reduce unnecessary investigations', 'implemented', 'high', 'DCSSDS'),
('NSW', 'child-protection', 'Family is Culture Review', 'Family is Culture', '2019-11-01', 'FIC-1', 'Transfer child protection decision-making for Aboriginal children to Aboriginal Community Controlled Organisations', 'pending', 'critical', 'DCJ'),
('NSW', 'child-protection', 'Family is Culture Review', 'Family is Culture', '2019-11-01', 'FIC-2', 'Abolish the risk assessment tool (SDM) which systematically disadvantages Aboriginal families', 'rejected', 'high', 'DCJ'),
('VIC', 'child-protection', 'Commission for Children and Young People', 'Annual Report 2023', '2023-11-15', 'CCYP-VIC-1', 'Reduce average caseloads for child protection practitioners to no more than 15 cases', 'pending', 'high', 'DFS'),
('NT', 'child-protection', 'Royal Commission NT', 'Final Report', '2017-11-17', 'RCNT-CP-1', 'Redesign child protection system with First Nations self-determination at centre', 'partially_implemented', 'critical', 'Territory Families'),
('SA', 'child-protection', 'Nyland Royal Commission', 'The Life They Deserve', '2016-08-01', 'NYLAND-1', 'Create independent Guardian for Children and Young People with investigative powers', 'implemented', 'critical', 'SA DCP'),
('SA', 'child-protection', 'Nyland Royal Commission', 'The Life They Deserve', '2016-08-01', 'NYLAND-2', 'Implement mandatory reporting for all adults in relation to child sexual abuse', 'implemented', 'high', 'SA Parliament')
ON CONFLICT DO NOTHING;


-- =============================================
-- DISABILITY — Policy Events
-- =============================================

INSERT INTO policy_events (jurisdiction, domain, event_date, title, description, event_type, severity, source, source_url)
VALUES
('National', 'disability', '2013-03-28', 'NDIS Act 2013', 'National Disability Insurance Scheme established. Lifetime approach to disability support, moving from block funding to individual packages.', 'legislation', 'critical', 'Commonwealth Parliament', NULL),
('National', 'disability', '2023-10-01', 'NDIS Review — Final Report', 'Independent review by Prof. Bruce Bonyhady and Lisa Paul. 26 recommendations including redesign of NDIS Act, new "foundational supports" outside NDIS, better planning.', 'report', 'critical', 'NDIS Review', 'https://www.ndisreview.gov.au/resources/reports/final-report'),
('National', 'disability', '2024-05-01', 'Getting the NDIS Back on Track Act 2024', 'Major NDIS reform legislation. New needs assessments, budgets replace plan values, foundational supports, participant pathway redesign.', 'legislation', 'critical', 'Commonwealth Parliament', NULL),
('National', 'disability', '2023-09-22', 'Disability Royal Commission — Final Report', 'Royal Commission into Violence, Abuse, Neglect and Exploitation of People with Disability. 7 years, 10,000+ submissions, 222 recommendations.', 'report', 'critical', 'Royal Commission', 'https://disability.royalcommission.gov.au/publications/final-report'),
('National', 'disability', '2021-12-03', 'Australia''s Disability Strategy 2021-2031', 'National strategy across 7 outcome areas. Replaces NDS 2010-2020. Guiding Principles include human rights, self-determination, accessibility.', 'framework', 'significant', 'DSS', NULL),
('National', 'disability', '2020-10-01', 'NDIS Participant Service Guarantee', 'Legislated service standards including timeframes for plan approval, plan reviews, and access decisions.', 'legislation', 'moderate', 'NDIA', NULL),
('National', 'disability', '2024-10-01', 'NDIS Budget: $42.7B for 2024-25', 'NDIS expenditure reaches $42.7B annually. Growth moderation target of 8% (down from 14%). Fraud and compliance measures.', 'budget', 'significant', 'Commonwealth Treasury', NULL),
('National', 'disability', '2022-03-01', 'NDIS Quality and Safeguards Commission strengthened', 'Enhanced compliance and enforcement powers. New worker screening requirements. Practice standards for behaviour support.', 'amendment', 'moderate', 'NDIS Commission', NULL),

-- State
('QLD', 'disability', '2023-03-01', 'Disability Services and Other Legislation (NDIS) Amendment Act 2023', 'QLD transitions remaining disability services to NDIS. Retains state role for foundational supports and advocacy.', 'legislation', 'moderate', 'QLD Parliament', NULL),
('VIC', 'disability', '2024-07-01', 'Victorian Disability Act Review', 'Review of Disability Act 2006. Focus on rights-based framework, community inclusion, and interaction with NDIS.', 'inquiry', 'moderate', 'DFFH', NULL),
('NSW', 'disability', '2014-07-01', 'NSW NDIS full scheme transition begins', 'NSW first major jurisdiction to begin full NDIS transition. Bilateral agreement with Commonwealth.', 'framework', 'significant', 'NSW Government', NULL),
('SA', 'disability', '2018-07-01', 'SA NDIS full scheme achieved', 'South Australia completes NDIS rollout. 50,000+ participants in first year of full scheme.', 'framework', 'moderate', 'SA Government', NULL),
('WA', 'disability', '2020-07-01', 'WA NDIS bilateral agreement', 'WA final jurisdiction to enter bilateral agreement. Previously ran own WA NDIS model.', 'framework', 'moderate', 'WA Government', NULL)
ON CONFLICT DO NOTHING;


-- =============================================
-- DISABILITY — Oversight Recommendations
-- =============================================

INSERT INTO oversight_recommendations (jurisdiction, domain, oversight_body, report_title, report_date, recommendation_number, recommendation_text, status, severity, target_department)
VALUES
('National', 'disability', 'Disability Royal Commission', 'Final Report', '2023-09-22', 'DRC-1', 'Phase out and prohibit group homes and congregate settings for people with disability by 2043', 'pending', 'critical', 'DSS/States'),
('National', 'disability', 'Disability Royal Commission', 'Final Report', '2023-09-22', 'DRC-2', 'Establish a Disability Rights Act to enshrine rights of people with disability in legislation', 'pending', 'critical', 'AGD'),
('National', 'disability', 'Disability Royal Commission', 'Final Report', '2023-09-22', 'DRC-3', 'Eliminate use of restrictive practices (chemical, mechanical, physical restraint, seclusion) by 2033', 'pending', 'critical', 'NDIS Commission'),
('National', 'disability', 'Disability Royal Commission', 'Final Report', '2023-09-22', 'DRC-4', 'All states and territories raise minimum age of criminal responsibility to 14 years', 'pending', 'high', 'State AGs'),
('National', 'disability', 'NDIS Review', 'Working together to deliver the NDIS', '2023-10-01', 'NDISR-1', 'Establish new "foundational supports" funded by all governments, outside the NDIS', 'partially_implemented', 'critical', 'DSS/NDIA'),
('National', 'disability', 'NDIS Review', 'Working together to deliver the NDIS', '2023-10-01', 'NDISR-2', 'Replace current planning process with new needs assessment and budget-based approach', 'partially_implemented', 'critical', 'NDIA'),
('National', 'disability', 'NDIS Review', 'Working together to deliver the NDIS', '2023-10-01', 'NDISR-3', 'Create navigator roles to help participants access both NDIS and foundational supports', 'pending', 'high', 'NDIA'),
('National', 'disability', 'Joint Standing Committee on NDIS', 'NDIS Workforce Inquiry', '2022-12-01', 'JSC-1', 'Develop national NDIS workforce strategy with pathway programs, wage increases, and rural incentives', 'partially_implemented', 'high', 'DSS'),
('National', 'disability', 'ANAO', 'NDIS Decision-Making Audit', '2023-06-15', 'ANAO-DIS-1', 'Improve consistency and transparency of NDIS access and planning decisions', 'partially_implemented', 'high', 'NDIA')
ON CONFLICT DO NOTHING;


-- =============================================
-- EDUCATION — Policy Events
-- =============================================

INSERT INTO policy_events (jurisdiction, domain, event_date, title, description, event_type, severity, source, source_url)
VALUES
('National', 'education', '2012-08-20', 'Gonski Review — Review of Funding for Schooling', 'Landmark review by David Gonski. Recommended needs-based funding model. $5B additional annual investment needed.', 'report', 'critical', 'DESE', NULL),
('National', 'education', '2017-06-23', 'Australian Education Act 2013 — Amended (Gonski 2.0)', 'Quality Schools Package. $23.5B additional over 10 years. Schooling Resource Standard (SRS) as basis for needs-based funding.', 'legislation', 'critical', 'Commonwealth Parliament', NULL),
('National', 'education', '2018-04-30', 'Gonski 2.0: Through Growth to Achievement', 'Review to Achieve Educational Excellence in Australian Schools. Focus on growth, tailored learning, evidence-based practice.', 'report', 'significant', 'DESE', NULL),
('National', 'education', '2024-12-20', 'Better and Fairer Schools Agreement 2025-2034', 'New National School Reform Agreement. All public schools to reach 100% SRS by 2034. Bilateral deals with states.', 'framework', 'critical', 'DESE', NULL),
('National', 'education', '2023-08-01', 'Universities Accord Final Report', 'Professor Mary O''Kane review. 47 recommendations including needs-based university funding, fee reform, 80% attainment target.', 'report', 'significant', 'DESE', NULL),
('National', 'education', '2024-05-01', 'Budget 2024-25: $4.4B education package', 'Fee-free TAFE extended. University Accord implementation begins. $500M for school infrastructure.', 'budget', 'significant', 'Commonwealth Treasury', NULL),
('National', 'education', '2022-11-01', 'National Teacher Workforce Action Plan', 'Cross-jurisdictional plan to address teacher shortages. Initial teacher education reform, mid-career pathways, workload reduction.', 'framework', 'moderate', 'Education Ministers Meeting', NULL),
('National', 'education', '2020-12-11', 'Alice Springs (Mparntwe) Education Declaration', 'Joint declaration by all education ministers. Two goals: promoting excellence and equity, becoming confident and creative learners.', 'framework', 'moderate', 'Education Council', NULL),

-- State
('QLD', 'education', '2024-01-01', 'Prep year funding boost — $150M', 'QLD increases prep year investment. Focus on play-based learning and early literacy/numeracy.', 'budget', 'moderate', 'QLD Education', NULL),
('NSW', 'education', '2023-03-01', 'NSW School Infrastructure — $8.6B program', 'Largest school building program in NSW history. 250+ projects including new schools and major upgrades.', 'budget', 'significant', 'NSW Education', NULL),
('VIC', 'education', '2023-01-01', 'Free Kinder for all Victorian 3 and 4 year olds', 'Landmark pre-school reform. $5B investment over decade. Universal access to two years of funded kinder.', 'legislation', 'significant', 'VIC DEECD', NULL),
('NT', 'education', '2022-06-01', 'NT Remote Schools Attendance Strategy', 'Targeted attendance improvement in 80+ remote schools. School Nutrition Program, engagement officers, community partnerships.', 'framework', 'moderate', 'NT Education', NULL),
('WA', 'education', '2024-07-01', 'WA Aboriginal Education Strategy 2024-2030', 'Focus on culturally responsive teaching, two-way learning, community engagement, and reducing attendance gaps.', 'framework', 'moderate', 'WA Education', NULL),
('TAS', 'education', '2022-01-01', 'Lifting Literacy and Numeracy — Years 3-6', 'Tasmania''s targeted literacy/numeracy intervention. $50M over 4 years. Evidence-based phonics and explicit instruction.', 'framework', 'moderate', 'TAS Education', NULL)
ON CONFLICT DO NOTHING;


-- =============================================
-- EDUCATION — Oversight Recommendations
-- =============================================

INSERT INTO oversight_recommendations (jurisdiction, domain, oversight_body, report_title, report_date, recommendation_number, recommendation_text, status, severity, target_department)
VALUES
('National', 'education', 'Gonski Review Panel', 'Through Growth to Achievement', '2018-04-30', 'GONSKI-1', 'Create an online, formative assessment tool that allows teachers to identify individual student needs and tailor teaching', 'partially_implemented', 'high', 'DESE'),
('National', 'education', 'Gonski Review Panel', 'Through Growth to Achievement', '2018-04-30', 'GONSKI-2', 'Revise the Australian Curriculum to focus on development of deep knowledge, skills and understanding', 'implemented', 'high', 'ACARA'),
('National', 'education', 'Universities Accord', 'Final Report', '2024-02-25', 'UA-1', 'Set a target of 80% of the working-age population to hold a post-school qualification by 2050', 'accepted', 'high', 'DESE'),
('National', 'education', 'Universities Accord', 'Final Report', '2024-02-25', 'UA-2', 'Implement needs-based university funding to replace demand-driven system', 'pending', 'critical', 'DESE'),
('National', 'education', 'Productivity Commission', 'ROGS 2026 — Schools', '2026-01-31', 'ROGS-EDU-1', 'Address widening gap in Year 9 NAPLAN results between metropolitan and remote students', 'pending', 'high', 'State Education Departments'),
('National', 'education', 'ANAO', 'National School Reform Agreement Audit', '2023-09-01', 'ANAO-EDU-1', 'Improve bilateral agreement transparency — clarify how SRS targets will be measured and reported', 'partially_implemented', 'medium', 'DESE'),
('NT', 'education', 'NT Auditor-General', 'School Attendance Audit', '2023-03-15', 'NTAG-EDU-1', 'Address chronic non-attendance in remote schools — 43% attendance rate in very remote NT schools', 'pending', 'critical', 'NT Education'),
('QLD', 'education', 'QLD Auditor-General', 'Investing in TAFE Queensland', '2023-11-01', 'QAO-EDU-1', 'Better align TAFE course offerings with regional workforce needs and skills shortages', 'pending', 'medium', 'QLD DESBT')
ON CONFLICT DO NOTHING;


-- =============================================
-- Report totals
-- =============================================

SELECT 'policy_events' as tbl, domain, COUNT(*) as count
FROM policy_events
GROUP BY domain
ORDER BY domain;

SELECT 'oversight_recommendations' as tbl, domain, COUNT(*) as count
FROM oversight_recommendations
GROUP BY domain
ORDER BY domain;
