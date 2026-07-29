import { emitEvent } from './events.js';
import { requirePrimaryAnchorForPromotion } from './artifacts.js';

const STATUS = new Set(['queued', 'in_review', 'changes_requested', 'approved', 'rejected', 'promoted']);

export const REVIEW_MODEL = {
  statuses: Array.from(STATUS),
  transitions: [
    'queued -> in_review',
    'in_review -> approved',
    'in_review -> rejected',
    'in_review -> changes_requested',
    'approved -> promoted',
  ],
  promotion_targets: ['business_core', 'workspace'],
};

function assertStatus(s) {
  const t = String(s);
  if (!STATUS.has(t)) throw new Error(`invalid status: ${t}`);
  return t;
}

async function getReview(pool, review_id) {
  const r = await pool.query('select * from review_queue where id=$1', [review_id]);
  if (r.rowCount === 0) throw new Error('review_queue item not found');
  return r.rows[0];
}

export async function requestReview(pool, {
  artifact_id,
  requested_by = 'system',
  reviewer = 'stephen',
  review_type = 'promotion',
  notes = null,
  actor = 'system',
}) {
  const r = await pool.query(
    `insert into review_queue(artifact_id, requested_by, reviewer, review_type, status, notes)
     values ($1,$2,$3,$4,'queued',$5)
     returning id`,
    [artifact_id, requested_by, reviewer, review_type, notes]
  );
  const id = r.rows[0].id;

  await emitEvent(pool, {
    event_level: 'review',
    event_type: 'review.requested',
    actor,
    artifact_id,
    payload: { review_id: id, reviewer, review_type },
  });

  return id;
}

export async function assignReview(pool, {
  review_id,
  actor = 'system',
}) {
  const item = await getReview(pool, review_id);
  if (assertStatus(item.status) !== 'queued') throw new Error('assignReview requires status=queued');

  await pool.query(
    `update review_queue set status='in_review' where id=$1`,
    [review_id]
  );

  await emitEvent(pool, {
    event_level: 'review',
    event_type: 'review.assigned',
    actor,
    artifact_id: item.artifact_id,
    payload: { review_id },
  });
}

export async function decideReview(pool, {
  review_id,
  decision, // approved | rejected | changes_requested
  promotion_target = null, // required if approved
  target_workspace_id = null, // required if promotion_target=workspace
  actor = 'stephen',
}) {
  const item = await getReview(pool, review_id);
  if (assertStatus(item.status) !== 'in_review') throw new Error('decideReview requires status=in_review');

  const d = String(decision);
  if (!['approved', 'rejected', 'changes_requested'].includes(d)) {
    throw new Error('invalid decision');
  }

  let nextStatus = d === 'approved' ? 'approved' : d === 'rejected' ? 'rejected' : 'changes_requested';

  // enforce constraints for approval
  if (d === 'approved') {
    if (!promotion_target) throw new Error('promotion_target is required when decision=approved');
    if (!['business_core', 'workspace'].includes(String(promotion_target))) throw new Error('invalid promotion_target');
    if (String(promotion_target) === 'workspace' && !target_workspace_id) {
      throw new Error('target_workspace_id is required when promotion_target=workspace');
    }
  }

  await pool.query(
    `update review_queue
     set status=$2,
         decision=$3,
         promotion_target=$4,
         target_workspace_id=$5,
         decided_at=now()
     where id=$1`,
    [review_id, nextStatus, d, promotion_target, target_workspace_id]
  );

  // emit decision event
  const eventType = d === 'approved' ? 'review.approved' : d === 'rejected' ? 'review.rejected' : 'review.changes_requested';
  await emitEvent(pool, {
    event_level: 'decision',
    event_type: eventType,
    actor,
    artifact_id: item.artifact_id,
    payload: { review_id, decision: d, promotion_target, target_workspace_id },
  });

  return nextStatus;
}

export async function promoteApproved(pool, {
  review_id,
  actor = 'system',
}) {
  const item = await getReview(pool, review_id);
  if (assertStatus(item.status) !== 'approved') throw new Error('promoteApproved requires status=approved');

  // Enforce anchor rule before promotion
  const ok = await requirePrimaryAnchorForPromotion(pool, {
    artifact_id: item.artifact_id,
    actor,
    context: { review_id },
  });
  if (!ok.ok) {
    // promotion blocked; do not move to promoted
    return { ok: false, blocked: true };
  }

  // Promotion approved event
  await emitEvent(pool, {
    event_level: 'decision',
    event_type: 'promotion.approved',
    actor,
    artifact_id: item.artifact_id,
    payload: { review_id, promotion_target: item.promotion_target, target_workspace_id: item.target_workspace_id },
  });

  try {
    // Execute promotion as scope/layer change (no new storage layer)
    // business_core = target scope/layer; workspace = link via target_workspace_id
    if (item.promotion_target === 'business_core') {
      await pool.query(`update artifacts set scope='business_core', updated_at=now() where id=$1`, [item.artifact_id]);
    } else if (item.promotion_target === 'workspace') {
      // keep personal_context scope; the promotion here is represented by the review_queue promoted status and the target workspace link.
      // (traceability remains via artifact_id)
      await pool.query(`update artifacts set updated_at=now() where id=$1`, [item.artifact_id]);
    } else {
      throw new Error('missing promotion_target');
    }

    await pool.query(`update review_queue set status='promoted' where id=$1`, [review_id]);

    await emitEvent(pool, {
      event_level: 'milestone',
      event_type: 'promotion.executed',
      actor,
      artifact_id: item.artifact_id,
      payload: { review_id, promotion_target: item.promotion_target, target_workspace_id: item.target_workspace_id },
    });

    return { ok: true, blocked: false };
  } catch (e) {
    await emitEvent(pool, {
      event_level: 'error',
      event_type: 'promotion.failed',
      actor,
      artifact_id: item.artifact_id,
      payload: { review_id, error: String(e) },
    });
    return { ok: false, blocked: false, error: String(e) };
  }
}
