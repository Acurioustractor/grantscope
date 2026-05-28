/**
 * Goods bed cost model v3 — the funder-grade unit-economics engine.
 *
 * All inputs live in `lib/data/goods-bed-cost-model.json` (single source of
 * truth, mirrored from `thoughts/shared/analysis/2026-05-28-goods-bed-cost-model-v3.json`
 * in act-infra). This module exposes typed accessors + pure compute functions
 * so the funder artifact view and the interactive cost-model page can render
 * from the same data.
 *
 * Verified rates come from `scripts/ocr-defy-bills.mjs` OCR'd invoice PDFs.
 * Plan: goods-cost-evidence-funder-artifact.
 */
import model from '@/lib/data/goods-bed-cost-model.json';

export type BedCostModel = typeof model;

export type BuildStateKey = 'state_1_defy_everything' | 'state_2_buy_kit_assemble' | 'state_3_buy_sheets_cut_assemble' | 'state_4_all_in_house' | 'state_5_community_plastic';

export interface BuildStateComponent {
  label: string;
  amount: number;
}

export interface BuildState {
  key: BuildStateKey;
  label: string;
  components: BuildStateComponent[];
  direct_total: number;
  capital_added: number;
  capital_cumulative: number;
}

export interface IdiotIndexRow {
  element: string;
  raw_low: number;
  raw_high: number;
  current: number;
  index_low: number;
  index_high: number;
  markup_pays_for: string;
  raw_basis?: string;
}

export interface VolumeScenario {
  label: string;
  beds_per_year: number;
  production_founder_per_bed: number;
  admin_per_bed: number;
  field_travel_per_bed: number;
  freight_per_bed: number;
  fully_loaded_state_1: number;
  fully_loaded_state_4: number;
  fully_loaded_state_5: number;
}

export interface FullyLoadedBreakdown {
  state: BuildStateKey;
  state_label: string;
  direct: number;
  freight: number;
  production_founder: number;
  admin: number;
  field_travel: number;
  total: number;
}

export function getBedCostModel(): BedCostModel {
  return model;
}

export function listBuildStates(): BuildState[] {
  const states = model.build_states as Record<string, Omit<BuildState, 'key'>>;
  return (Object.entries(states) as Array<[BuildStateKey, Omit<BuildState, 'key'>]>).map(([key, value]) => ({
    key,
    ...value,
  }));
}

export function getIdiotIndex(): IdiotIndexRow[] {
  return model.idiot_index as IdiotIndexRow[];
}

export function getVolumeScenarios(): VolumeScenario[] {
  return model.volume_scenarios as VolumeScenario[];
}

/**
 * Compute the fully-loaded per-bed cost for a given build state and volume scenario.
 * This is the pure-function version of the JSON's hard-coded numbers — used when
 * the interactive page lets the user override any input.
 */
export function computeFullyLoaded(state: BuildState, scenario: VolumeScenario): FullyLoadedBreakdown {
  const direct = state.direct_total;
  const freight = scenario.freight_per_bed;
  const production_founder = scenario.production_founder_per_bed;
  const admin = scenario.admin_per_bed;
  const field_travel = scenario.field_travel_per_bed;
  return {
    state: state.key,
    state_label: state.label,
    direct,
    freight,
    production_founder,
    admin,
    field_travel,
    total: direct + freight + production_founder + admin + field_travel,
  };
}

/**
 * The hero number for the funder artifact: today's State-1-Defy fully-loaded cost,
 * presented as the honest starting point. The "path to" target is State-4 @ 500/yr.
 */
export function getHeroPicture() {
  const states = listBuildStates();
  const scenarios = getVolumeScenarios();
  const today = scenarios[0]!; // 100/yr
  const target = scenarios[1]!; // 500/yr
  const vision = scenarios[2]!; // 1000/yr
  const state1 = states.find((s) => s.key === 'state_1_defy_everything')!;
  const state4 = states.find((s) => s.key === 'state_4_all_in_house')!;
  const state5 = states.find((s) => s.key === 'state_5_community_plastic')!;
  return {
    today: computeFullyLoaded(state1, today),
    target: computeFullyLoaded(state4, target),
    vision: computeFullyLoaded(state5, vision),
    commercial: {
      low: model.counterfactual.commercial_steel_frame_bed_au_2026_low,
      high: model.counterfactual.commercial_steel_frame_bed_au_2026_high,
    },
    capex_to_target: {
      low: model.capex_required_to_reach_state_4._capital_ask_low,
      high: model.capex_required_to_reach_state_4._capital_ask_high,
    },
  };
}

export function getFundraisingOffset() {
  const fr = model.fundraising_offset;
  return {
    philanthropy_days: fr.philanthropy_days_per_year,
    philanthropy_annual: fr.philanthropy_annual_estimate,
    commercial_days: fr.commercial_sales_days_per_year,
    buyer_benchmark: fr.commercial_buyer_benchmark_per_bed,
    buyer_source: fr.commercial_buyer_source,
    subsidy_at_100: fr._per_bed_subsidy_at_100_per_year,
    subsidy_at_500: fr._per_bed_subsidy_at_500_per_year,
  };
}

export function getFounderAllocation() {
  return {
    rate_per_day: model.founder_time_allocation.rate_per_day,
    total_days: model.founder_time_allocation.total_days_per_year_on_goods,
    split: model.founder_time_allocation.split,
  };
}

export function getDefyVerifiedRates() {
  return model.defy_verified_rates;
}

export function getMistagsToFix() {
  return model.mistags_to_fix;
}

export function getOpenQuestionsForDefy() {
  return model.open_questions_for_defy;
}

/**
 * Format money in AUD with thousands separators, no decimals unless < $10.
 */
export function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}
