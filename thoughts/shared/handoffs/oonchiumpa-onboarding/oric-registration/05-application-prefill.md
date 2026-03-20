# ORIC Registration Application — Pre-Fill Data

> **HOW TO USE:** Take this to the ORIC online form (oric.gov.au) or pre-incorporation meeting.
> All fields marked [CONFIRM] need Kristy/Tanya to verify.

---

## Corporation Details

| Field | Value |
|-------|-------|
| **Proposed name** | Oonchiumpa Aboriginal Corporation |
| **Alternative name** (if first unavailable) | Oonchiumpa Community Aboriginal Corporation |
| **Corporation type** | Small (revenue <$100K, assets <$100K, <5 employees) |
| **Financial year end** | 30 June |
| **Registered office address** | [CONFIRM — Kristy/Tanya's address or office], Alice Springs NT 0870 |
| **Postal address** | [CONFIRM — same or PO Box] |
| **Contact phone** | [CONFIRM] |
| **Contact email** | [CONFIRM] |
| **Common seal** | No |

---

## Objectives (for application form)

**Primary purpose statement** (short version for form):

> Oonchiumpa Aboriginal Corporation provides culturally grounded youth empowerment, justice diversion, social enterprise, and on-country cultural programs for Aboriginal people in Central Australia. The corporation creates employment pathways through community-based enterprises, operates cultural retreat programs on traditional country, and supports young Aboriginal people to maintain cultural connection while building skills for contemporary life.

**Detailed objectives** — see rule book Section 1.3 for full list (7 objectives).

---

## Foundation Members

> **REQUIREMENT:** Minimum 5 members. All must be 15+. Majority must be Aboriginal/TSI.
> 75% must sign consent forms before lodging.

| # | Full Name | DOB | Address | Aboriginal/TSI | Director? |
|---|-----------|-----|---------|---------------|-----------|
| 1 | Kristy Bloomfield | [CONFIRM] | [CONFIRM], Alice Springs NT 0870 | Yes | Yes |
| 2 | Tanya Turner | [CONFIRM] | [CONFIRM], Alice Springs NT 0870 | Yes | Yes |
| 3 | [CONFIRM — Elder?] | [CONFIRM] | [CONFIRM] | Yes | Yes |
| 4 | [CONFIRM — Patricia Ann Miller?] | [CONFIRM] | [CONFIRM] | Yes | No |
| 5 | [CONFIRM — Kylie? Community member?] | [CONFIRM] | [CONFIRM] | Yes | No |

**Suggested additional members** (strengthens the application):
- Family members connected to At Napa / Loves Creek country
- Young people from the youth program (if 15+)
- Partner organisation representatives
- Other Elders (Uncle Terry, Aunty Bev if not already listed)

---

## Foundation Directors

| Position | Name | DOB | Address | Aboriginal/TSI |
|----------|------|-----|---------|---------------|
| **Chairperson** | Kristy Bloomfield | [CONFIRM] | [CONFIRM] | Yes |
| **Deputy Chairperson** | Tanya Turner | [CONFIRM] | [CONFIRM] | Yes |
| **Director** | [CONFIRM] | [CONFIRM] | [CONFIRM] | [CONFIRM] |

**Director consent:** Each director must consent in writing to being appointed and declare they are not disqualified under the CATSI Act (not bankrupt, no relevant convictions).

---

## Applicant Details

| Field | Value |
|-------|-------|
| **Name of person lodging** | [CONFIRM — Kristy or Tanya] |
| **Relationship to proposed corporation** | Foundation member and proposed director |
| **Contact phone** | [CONFIRM] |
| **Contact email** | [CONFIRM] |

---

## Attachments Required

- [ ] Completed rule book (signed/agreed by members)
- [ ] Member consent forms (75%+ signed)
- [ ] List of foundation members with details
- [ ] List of foundation directors with details and consent
- [ ] Registered office address notification

---

## Related Entity Information (for ORIC's awareness)

| Field | Value |
|-------|-------|
| **Related entity** | Oonchiumpa Consultancy & Services Pty Ltd |
| **ABN** | 53 658 668 627 |
| **Relationship** | Same directors (Kristy Bloomfield, Tanya Turner). The Pty Ltd will continue to operate as the commercial arm. The Aboriginal Corporation will manage grant-funded community programs. |
| **Why registering separately** | To access government and philanthropic grants requiring NFP status, particularly Aboriginal Investment NT programs. |

---

## CivicGraph Entity Data (for reference)

From the CivicGraph database, Oonchiumpa-related entities:

| Entity | Type | ABN | In CivicGraph |
|--------|------|-----|---------------|
| Oonchiumpa Consultancy & Services Pty Ltd | company | 53658668627 | Check |
| Oochiumpa Youth Services | indigenous_corp | — | Check (ALMA data) |

**After ORIC registration:** Update CivicGraph with the new entity:
```sql
-- After ICN is issued:
INSERT INTO gs_entities (canonical_name, abn, entity_type, state, postcode, sector)
VALUES ('Oonchiumpa Aboriginal Corporation', '[new ABN if issued]', 'indigenous_corp', 'NT', '0870', 'youth-justice');
```
