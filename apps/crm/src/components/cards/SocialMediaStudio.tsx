import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createSocialPost,
  fetchChildOrganizations,
  fetchMyOrganization,
  fetchSocialPosts,
  updateSocialPost,
} from '../../lib/queries';
import type { Organization, SocialPost, SocialPostStatus } from '../../types';
import DemoCard from '@hhs/shared-ui'DemoCard';
import DataTable from '@hhs/shared-ui'DataTable';
import KpiCard from '@hhs/shared-ui'KpiCard';
import StatusBadge from '@hhs/shared-ui'StatusBadge';

const PLATFORMS = ['Instagram', 'Facebook', 'X', 'LinkedIn', 'TikTok'] as const;

const IDEA_SEEDS = [
  {
    title: 'Probe demo in one minute',
    platform: 'Instagram',
    campaign: 'Probe Proof',
    content:
      'Hook: Show the Fusion44X probe solving the problem in one minute.\n\nBody: Focus on the before and after. What the operator sees. Why it matters. Keep it visual and direct.\n\nCTA: Ask for a demo or a walkthrough.',
  },
  {
    title: 'Distribution win story',
    platform: 'LinkedIn',
    campaign: 'Partner Wins',
    content:
      'Hook: A real distribution story beats a generic product pitch every time.\n\nBody: Share the problem, the setup, and the result. Highlight the main account and sub-account structure where it helps the rollout.\n\nCTA: Reach out if you want the partner version of the playbook.',
  },
  {
    title: 'Water tip of the day',
    platform: 'X',
    campaign: 'Daily Education',
    content:
      'Hook: The fastest way to lose trust is to ignore small water issues.\n\nBody: Give one practical tip that helps someone understand water quality, maintenance, or early warning signs.\n\nCTA: Follow for the next quick tip.',
  },
  {
    title: 'FAQ turned into a post',
    platform: 'Facebook',
    campaign: 'FAQ Series',
    content:
      'Hook: Here is the question we hear most often.\n\nBody: Answer it in plain English, then connect it back to the probe or service workflow.\n\nCTA: Comment with the next question you want answered.',
  },
] as const;

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function statusTone(status: SocialPostStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'Published':
      return 'success';
    case 'Approved':
    case 'Scheduled':
      return 'info';
    case 'Ready for Review':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function SocialMediaStudio() {
  const { user, profile } = useAuth();
  const canManage = profile?.role === 'manufacturer' || profile?.role === 'distributor';
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    platform: 'Instagram',
    content: '',
    campaign: '',
    scheduled_for: '',
    organization_id: '',
  });

  useEffect(() => {
    fetchSocialPosts()
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      try {
        const main = await fetchMyOrganization();
        if (!main) {
          if (!cancelled) {
            setAccounts([]);
            setForm((prev) => ({ ...prev, organization_id: '' }));
          }
          return;
        }

        const children = await fetchChildOrganizations(main.id);
        if (cancelled) return;

        const nextAccounts = [main, ...children];
        setAccounts(nextAccounts);
        setForm((prev) => ({
          ...prev,
          organization_id:
            prev.organization_id && nextAccounts.some((account) => account.id === prev.organization_id)
              ? prev.organization_id
              : main.id,
        }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load accounts');
        }
      } finally {
        if (!cancelled) {
          setAccountsLoaded(true);
        }
      }
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const counts = useMemo(() => {
    const totals: Record<SocialPostStatus, number> = {
      Draft: 0,
      'Ready for Review': 0,
      Approved: 0,
      Scheduled: 0,
      Published: 0,
    };

    for (const post of posts) {
      totals[post.status] += 1;
    }

    return totals;
  }, [posts]);

  const platformStats = useMemo(() => {
    const totals = new Map<string, number>();
    for (const post of posts) {
      totals.set(post.platform, (totals.get(post.platform) ?? 0) + 1);
    }

    const totalPosts = posts.length || 1;
    return Array.from(totals.entries())
      .map(([platform, count]) => ({
        platform,
        count,
        pct: Math.round((count / totalPosts) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [posts]);

  const recentPublished = useMemo(
    () => posts.filter((post) => post.status === 'Published').slice(0, 3),
    [posts]
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);

    try {
      const created = await createSocialPost({
        title: form.title.trim(),
        platform: form.platform,
        content: form.content.trim(),
        campaign: form.campaign.trim() || undefined,
        organization_id: form.organization_id || undefined,
        status: 'Draft',
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      });

      setPosts((prev) => [created, ...prev]);
      setForm({
        title: '',
        platform: 'Instagram',
        content: '',
        campaign: '',
        scheduled_for: '',
        organization_id: accounts[0]?.id ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create social post');
    } finally {
      setSaving(false);
    }
  }

  async function transitionPost(post: SocialPost, nextStatus: SocialPostStatus) {
    setError(null);

    try {
      const updates: Parameters<typeof updateSocialPost>[1] = { status: nextStatus };
      if (nextStatus === 'Approved') {
        updates.approved_by = user?.id ?? post.approved_by;
      }
      if (nextStatus === 'Published') {
        updates.published_at = new Date().toISOString();
      }

      const updated = await updateSocialPost(post.id, updates);
      setPosts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    }
  }

  function applyIdea(seed: (typeof IDEA_SEEDS)[number]) {
    if (!canManage) return;

    setForm((prev) => ({
      ...prev,
      title: seed.title,
      platform: seed.platform,
      content: seed.content,
      campaign: seed.campaign,
      organization_id: prev.organization_id || accounts[0]?.id || '',
    }));
  }

  const columns = [
    { key: 'account', label: 'Account' },
    { key: 'title', label: 'Title' },
    { key: 'platform', label: 'Platform' },
    { key: 'status', label: 'Status' },
    { key: 'scheduled_for', label: 'Scheduled' },
    { key: 'actions', label: 'Actions' },
  ];

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name] as const)),
    [accounts]
  );

  const rows = posts.map((post) => {
    const action =
      post.status === 'Draft' ? (
        <button
          type="button"
          onClick={() => transitionPost(post, 'Ready for Review')}
          className="rounded-lg border border-fusion-blue px-2 py-1 text-[10px] font-semibold text-fusion-blue hover:bg-blue-50"
        >
          Send to review
        </button>
      ) : post.status === 'Ready for Review' ? (
        <button
          type="button"
          onClick={() => transitionPost(post, 'Approved')}
          className="rounded-lg bg-fusion-blue px-2 py-1 text-[10px] font-semibold text-white hover:bg-fusion-blue-light"
        >
          Approve
        </button>
      ) : post.status === 'Approved' ? (
        <button
          type="button"
          onClick={() => transitionPost(post, 'Scheduled')}
          className="rounded-lg bg-fusion-blue px-2 py-1 text-[10px] font-semibold text-white hover:bg-fusion-blue-light"
        >
          Schedule
        </button>
      ) : post.status === 'Scheduled' ? (
        <button
          type="button"
          onClick={() => transitionPost(post, 'Published')}
          className="rounded-lg bg-fusion-success px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90"
        >
          Publish
        </button>
      ) : (
        <span className="text-[10px] text-fusion-text-muted">Done</span>
      );

    return {
      account: accountNameById.get(post.organization_id ?? '') ?? 'Main account',
      title: post.title,
      platform: post.platform,
      status: (
        <StatusBadge variant={statusTone(post.status)}>
          {post.status}
        </StatusBadge>
      ),
      scheduled_for: formatDateTime(post.scheduled_for),
      actions: <div className="flex justify-end">{action}</div>,
    };
  });

  return (
    <DemoCard number={9} title="Social Media Studio" className="xl:col-span-2">
      {loading || (canManage && !accountsLoaded) ? (
        <div className="py-4 text-center text-[11px] text-fusion-text-muted">Loading...</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            <KpiCard label="Draft" value={String(counts.Draft)} icon={<Sparkles size={12} />} />
            <KpiCard label="Review" value={String(counts['Ready for Review'])} icon={<Send size={12} />} />
            <KpiCard label="Approved" value={String(counts.Approved)} icon={<ShieldCheck size={12} />} />
            <KpiCard label="Scheduled" value={String(counts.Scheduled)} icon={<CalendarDays size={12} />} />
            <KpiCard label="Published" value={String(counts.Published)} icon={<CheckCircle2 size={12} />} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Social data
                  </p>
                  <h4 className="text-sm font-semibold text-fusion-text">Channel mix and recent wins</h4>
                </div>
                <BarChart3 size={14} className="text-fusion-blue" />
              </div>

              {platformStats.length > 0 ? (
                <div className="space-y-2">
                  {platformStats.map((item) => (
                    <div key={item.platform} className="rounded-lg border border-fusion-border-light bg-white px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-fusion-text">{item.platform}</span>
                        <span className="text-[10px] font-semibold text-fusion-text-muted">
                          {item.count} posts / {item.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-fusion-blue"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                  No social posts yet. Add a draft and this panel turns into an actual dashboard.
                </div>
              )}

              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                  Recent published posts
                </p>
                {recentPublished.length > 0 ? (
                  recentPublished.map((post) => (
                    <div key={post.id} className="rounded-lg border border-fusion-border-light bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-fusion-text">{post.title}</span>
                        <StatusBadge variant="success">Published</StatusBadge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-fusion-text-muted">
                        <span>{post.platform}</span>
                        <span>{formatDateTime(post.published_at ?? post.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                    Nothing published yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Idea lab
                  </p>
                  <h4 className="text-sm font-semibold text-fusion-text">One-click post ideas</h4>
                </div>
                <Lightbulb size={14} className="text-fusion-blue" />
              </div>

              <div className="space-y-2">
                {IDEA_SEEDS.map((seed) => (
                  <button
                    key={seed.title}
                    type="button"
                    onClick={() => applyIdea(seed)}
                    disabled={!canManage}
                    className="w-full rounded-lg border border-fusion-border-light bg-white px-3 py-2 text-left transition-colors hover:border-fusion-blue/30 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-fusion-text">{seed.title}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-fusion-blue">
                        {seed.platform}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-fusion-text-muted">
                      {seed.content.split('\n\n')[0]}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-fusion-border-light bg-white px-3 py-2 text-[11px] text-fusion-text-muted">
                Tap one of the ideas to load a draft into the post creator below. No more staring at the cursor like it owes you money.
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {canManage ? (
            <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Title
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                    placeholder="New product spotlight"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Platform
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                  >
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Target account
                  </label>
                  <select
                    value={form.organization_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, organization_id: e.target.value }))}
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                    required
                  >
                    <option value="" disabled>
                      Select account
                    </option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Publish mode
                  </label>
                  <select
                    value={form.scheduled_for ? 'scheduled' : 'draft'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        scheduled_for: e.target.value === 'scheduled' ? prev.scheduled_for : '',
                      }))
                    }
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="min-h-28 w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                  placeholder="Write the post copy, hook, CTA, and approval notes."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Campaign
                  </label>
                  <input
                    value={form.campaign}
                    onChange={(e) => setForm((prev) => ({ ...prev, campaign: e.target.value }))}
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                    placeholder="Q3 pool push"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                    Schedule
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_for: e.target.value }))}
                    className="w-full rounded-lg border border-fusion-border bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    content:
                      prev.content ||
                      `Hook: ${prev.title || 'New offer'}\n\nBody: Share why this matters, how it helps, and what to do next.\n\nCTA: Book the call, review the offer, or reply to get the full details.`,
                  }))
                }
                className="rounded-lg border border-fusion-border-light px-3 py-2 text-xs font-medium text-fusion-text hover:border-fusion-blue/30 hover:text-fusion-blue"
              >
                Generate simple draft
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-fusion-blue px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-fusion-blue-light disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Draft'}
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Read-only view. Social publishing is limited to manufacturer and distributor roles.
            </div>
          )}

          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
              Post Queue
            </span>
            {rows.length > 0 ? (
              <DataTable columns={columns} rows={rows} />
            ) : (
              <div className="py-2 text-[11px] text-fusion-text-muted">No social posts yet</div>
            )}
          </div>
        </div>
      )}
    </DemoCard>
  );
}
