import { runProcurementDiscovery } from './discovery';
import {
  createProcurementAlerts,
  createProcurementTasks,
  getProcurementContext,
  getShortlistWatch,
  logProcurementWorkflowRun,
  normalizeSupplierKey,
  updateShortlistWatch,
} from './procurement-workspace';
import { getServiceSupabase } from '@/lib/supabase';

type ServiceDb = ReturnType<typeof getServiceSupabase>;

type DiscoverySnapshotItem = {
  gs_id: string;
  supplier_name: string;
  supplier_abn: string | null;
  contract_count: number;
  contract_total_value: number;
  latest_revenue: number | null;
};

function asSnapshot(value: unknown): Record<string, DiscoverySnapshotItem> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item && typeof item === 'object'),
  ) as Record<string, DiscoverySnapshotItem>;
}

function taskDueIso(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

export async function rerunProcurementShortlist(
  serviceDb: ServiceDb,
  params: {
    shortlistId: string;
    userId: string;
    trigger: 'manual' | 'automation';
  },
) {
  const context = await getProcurementContext(serviceDb, params.userId, { shortlistId: params.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('No procurement shortlist found.');
  }

  const startedAt = new Date().toISOString();
  const filters = (context.shortlist.filters || {}) as Record<string, unknown>;

  let discovery;
  try {
    discovery = await runProcurementDiscovery(serviceDb, {
      state: typeof filters.state === 'string' ? filters.state : null,
      postcode: typeof filters.postcode === 'string' ? filters.postcode : null,
      lga: typeof filters.lga === 'string' ? filters.lga : null,
      entity_types: Array.isArray(filters.entity_types) ? filters.entity_types.filter((value): value is string => typeof value === 'string') : undefined,
      remoteness: typeof filters.remoteness === 'string' ? filters.remoteness : null,
      community_controlled: filters.community_controlled === true,
      min_contracts: typeof filters.min_contracts === 'number' ? filters.min_contracts : 0,
      limit: typeof filters.limit === 'number' ? filters.limit : 100,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to rerun saved brief';
    await logProcurementWorkflowRun(serviceDb, {
      userId: params.userId,
      workflowType: 'discover',
      workflowStatus: 'failed',
      shortlistId: params.shortlistId,
      inputPayload: { ...filters, rerun: true, trigger: params.trigger },
      outputSummary: { error: message, trigger: params.trigger },
      errorCount: 1,
      startedAt,
    });
    throw error;
  }

  const [{ watch }, { data: shortlistItems, error: shortlistItemError }] = await Promise.all([
    getShortlistWatch(serviceDb, params.userId, { shortlistId: params.shortlistId, createIfMissing: true }),
    serviceDb
      .from('procurement_shortlist_items')
      .select('id, supplier_key')
      .eq('shortlist_id', params.shortlistId),
  ]);

  if (shortlistItemError) {
    throw shortlistItemError;
  }

  const shortlistItemIdByKey = new Map((shortlistItems || []).map((item) => [item.supplier_key, item.id]));
  const nextSnapshot = Object.fromEntries(
    discovery.suppliers.map((supplier) => {
      const key = normalizeSupplierKey({
        gs_id: supplier.gs_id,
        abn: supplier.abn,
        canonical_name: supplier.canonical_name,
      });
      return [key, {
        gs_id: supplier.gs_id,
        supplier_name: supplier.canonical_name,
        supplier_abn: supplier.abn,
        contract_count: supplier.contracts.count,
        contract_total_value: supplier.contracts.total_value,
        latest_revenue: supplier.latest_revenue,
      } satisfies DiscoverySnapshotItem];
    }),
  );
  const previousSnapshot = asSnapshot(watch?.last_result_snapshot);

  const alertsToCreate: Parameters<typeof createProcurementAlerts>[1]['alerts'] = [];
  const tasksToCreate: Parameters<typeof createProcurementTasks>[1]['tasks'] = [];
  let newSupplierCount = 0;
  let removedSupplierCount = 0;
  let contractSignalChanges = 0;

  for (const [key, nextItem] of Object.entries(nextSnapshot)) {
    const previousItem = previousSnapshot[key];
    if (!previousItem) {
      newSupplierCount += 1;
      alertsToCreate.push({
        shortlistItemId: shortlistItemIdByKey.get(key) || null,
        alertType: 'new_supplier',
        severity: 'info',
        title: `New supplier matched ${context.shortlist.name}`,
        body: `${nextItem.supplier_name} now matches the saved procurement brief.`,
        payload: {
          supplier_key: key,
          gs_id: nextItem.gs_id,
          supplier_abn: nextItem.supplier_abn,
          shortlist_name: context.shortlist.name,
        },
      });
      tasksToCreate.push({
        shortlistItemId: shortlistItemIdByKey.get(key) || null,
        taskKey: `${params.shortlistId}:new_supplier:${key}`,
        taskType: 'review_alert',
        title: `Review new supplier: ${nextItem.supplier_name}`,
        description: `${nextItem.supplier_name} is newly matched to ${context.shortlist.name}. Confirm fit, decision tag, and next step.`,
        priority: 'medium',
        dueAt: taskDueIso(2),
        metadata: {
          supplier_key: key,
          gs_id: nextItem.gs_id,
          supplier_abn: nextItem.supplier_abn,
          source_alert_type: 'new_supplier',
          trigger: params.trigger,
        },
      });
      continue;
    }

    if (
      previousItem.contract_count !== nextItem.contract_count
      || previousItem.contract_total_value !== nextItem.contract_total_value
    ) {
      contractSignalChanges += 1;
      alertsToCreate.push({
        shortlistItemId: shortlistItemIdByKey.get(key) || null,
        alertType: 'contract_signal_changed',
        severity: 'warning',
        title: `Contract signal changed for ${nextItem.supplier_name}`,
        body: `Contracts moved from ${previousItem.contract_count} to ${nextItem.contract_count}.`,
        payload: {
          supplier_key: key,
          gs_id: nextItem.gs_id,
          previous_contract_count: previousItem.contract_count,
          next_contract_count: nextItem.contract_count,
          previous_contract_total_value: previousItem.contract_total_value,
          next_contract_total_value: nextItem.contract_total_value,
        },
      });
      tasksToCreate.push({
        shortlistItemId: shortlistItemIdByKey.get(key) || null,
        taskKey: `${params.shortlistId}:contract_signal_changed:${key}`,
        taskType: 'evidence_check',
        title: `Recheck contract evidence: ${nextItem.supplier_name}`,
        description: `Contract history changed for ${nextItem.supplier_name}. Confirm whether the shortlist decision, risk note, or pack needs updating.`,
        priority: 'high',
        dueAt: taskDueIso(1),
        metadata: {
          supplier_key: key,
          gs_id: nextItem.gs_id,
          previous_contract_count: previousItem.contract_count,
          next_contract_count: nextItem.contract_count,
          previous_contract_total_value: previousItem.contract_total_value,
          next_contract_total_value: nextItem.contract_total_value,
          source_alert_type: 'contract_signal_changed',
          trigger: params.trigger,
        },
      });
    }
  }

  for (const [key, previousItem] of Object.entries(previousSnapshot)) {
    if (nextSnapshot[key]) continue;
    removedSupplierCount += 1;
    alertsToCreate.push({
      alertType: 'removed_supplier',
      severity: 'warning',
      title: `${previousItem.supplier_name} no longer matches ${context.shortlist.name}`,
      body: `${previousItem.supplier_name} dropped out of the saved procurement brief on rerun.`,
      payload: {
        supplier_key: key,
        gs_id: previousItem.gs_id,
        supplier_abn: previousItem.supplier_abn,
        shortlist_name: context.shortlist.name,
      },
    });
    tasksToCreate.push({
      taskKey: `${params.shortlistId}:removed_supplier:${key}`,
      taskType: 'review_alert',
      title: `Review removed match: ${previousItem.supplier_name}`,
      description: `${previousItem.supplier_name} no longer matches ${context.shortlist.name}. Confirm whether to keep it in the shortlist or close it out.`,
      priority: 'medium',
      dueAt: taskDueIso(2),
      metadata: {
        supplier_key: key,
        gs_id: previousItem.gs_id,
        supplier_abn: previousItem.supplier_abn,
        source_alert_type: 'removed_supplier',
        trigger: params.trigger,
      },
    });
  }

  const limitedAlerts = alertsToCreate.slice(0, 25);
  const createdAlerts = await createProcurementAlerts(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: params.shortlistId,
    alerts: limitedAlerts,
  });

  const createdTasks = await createProcurementTasks(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: params.shortlistId,
    userId: params.userId,
    tasks: tasksToCreate.slice(0, 25).map((task, index) => ({
      ...task,
      alertId: createdAlerts[index]?.id || null,
    })),
  });

  const now = new Date();
  const nextRunAt = watch?.enabled
    ? new Date(now.getTime() + (watch.interval_hours || 24) * 60 * 60 * 1000).toISOString()
    : null;

  const updatedWatch = await updateShortlistWatch(serviceDb, params.userId, {
    shortlistId: params.shortlistId,
    enabled: watch?.enabled ?? false,
    intervalHours: watch?.interval_hours ?? 24,
    lastRunAt: now.toISOString(),
    nextRunAt,
    lastSummary: {
      total_found: discovery.summary.total_found,
      alerts_created: createdAlerts.length,
      tasks_created: createdTasks.length,
      new_supplier_count: newSupplierCount,
      removed_supplier_count: removedSupplierCount,
      contract_signal_changes: contractSignalChanges,
      trigger: params.trigger,
    },
    lastResultSnapshot: nextSnapshot,
    lastAlertCount: createdAlerts.length,
  });

  await logProcurementWorkflowRun(serviceDb, {
    userId: params.userId,
    workflowType: 'discover',
    workflowStatus: 'completed',
    shortlistId: params.shortlistId,
    inputPayload: { ...discovery.appliedFilters, rerun: true, trigger: params.trigger },
    outputSummary: {
      total_found: discovery.summary.total_found,
      alerts_created: createdAlerts.length,
      tasks_created: createdTasks.length,
      new_supplier_count: newSupplierCount,
      removed_supplier_count: removedSupplierCount,
      contract_signal_changes: contractSignalChanges,
      trigger: params.trigger,
    },
    recordsScanned: discovery.recordsScanned,
    recordsChanged: discovery.suppliers.length,
    startedAt,
  });

  return {
    context,
    discovery,
    delta: {
      new_supplier_count: newSupplierCount,
      removed_supplier_count: removedSupplierCount,
      contract_signal_changes: contractSignalChanges,
      alerts_created: createdAlerts.length,
      tasks_created: createdTasks.length,
    },
    watch: updatedWatch.watch,
    alerts: createdAlerts,
    tasks: createdTasks,
  };
}
