import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { adminApi } from '../api/admin';
import { extractErrorMessage } from '../api/client';
import { Pagination } from '../components/Pagination';
import { SearchField } from '../components/SearchField';
import type {
  AdminOverview,
  AdminSellerRow,
  AdminUserDetail,
  AdminUserRow,
  Plan,
} from '../types/api';

const LIMIT = 25;
const fmt = (n: number) => n.toLocaleString('ru-RU');
const tenge = (n: number) => `${fmt(n)} ₸`;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

function Badge({ tone, children }: { tone: 'up' | 'dn' | 'warn' | 'neutral' | 'purple'; children: ReactNode }) {
  if (tone === 'purple') {
    return (
      <span className="badge" style={{ background: 'var(--purple50)', color: 'var(--purple600)' }}>
        {children}
      </span>
    );
  }
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Kpi({ color, label, value, sub }: { color: string; label: string; value: string; sub?: string }) {
  return (
    <div className={`kpi ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
      {sub && <div className="kpi-delta">{sub}</div>}
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text3)',
  padding: '0 10px 8px',
};
const tdStyle: CSSProperties = { padding: '9px 10px', fontSize: 12.5, color: 'var(--text)', borderTop: '0.5px solid rgba(0,0,0,0.05)' };

function planBadge(plan: Plan) {
  return <Badge tone={plan === 'pro' ? 'purple' : 'neutral'}>{plan}</Badge>;
}
function statusBadge(status: string) {
  return status === 'ok' ? <Badge tone="up">ok</Badge> : <Badge tone="dn">needs reauth</Badge>;
}

// ---------------------------------------------------------------------------

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [ovError, setOvError] = useState<string | null>(null);
  const [view, setView] = useState<'users' | 'sellers'>('users');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const loadOverview = useCallback(() => {
    adminApi
      .overview()
      .then(setOverview)
      .catch((e) => setOvError(extractErrorMessage(e)));
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return (
    <div>
      {/* --- Overview KPIs --- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Обзор платформы</div>
        {ovError && <div style={{ color: 'var(--coral600)', fontSize: 12 }}>{ovError}</div>}
        {overview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            <Kpi color="purple" label="Пользователи" value={fmt(overview.users.total)} sub={`+${overview.users.new30d} за 30 дней`} />
            <Kpi color="teal" label="PRO / FREE" value={`${overview.users.pro} / ${overview.users.free}`} sub={`${overview.users.admins} админ.`} />
            <Kpi color="blue" label="Магазины" value={fmt(overview.sellers.total)} sub={overview.sellers.needsReauth > 0 ? `⚠ ${overview.sellers.needsReauth} нужна переавториз.` : 'все синхронизируются'} />
            <Kpi color="gray" label="GMV (выдано)" value={tenge(overview.data.gmvCompleted)} />
            <Kpi color="gray" label="Заказов" value={fmt(overview.data.orders)} sub={`${fmt(overview.data.products)} товаров`} />
            <Kpi color="gray" label="Расчётов юнит-эк." value={fmt(overview.data.unitEconomicsCalcs)} />
          </div>
        )}
      </div>

      {/* --- Segmented sub-nav --- */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['users', 'sellers'] as const).map((v) => (
          <button
            key={v}
            className="seg-btn"
            onClick={() => setView(v)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: view === v ? 500 : 400,
              background: view === v ? '#1F1F1F' : '#fff',
              color: view === v ? '#fff' : 'var(--text2)',
              boxShadow: view === v ? 'none' : '0 0 0 0.5px rgba(0,0,0,0.12) inset',
            }}
          >
            {v === 'users' ? 'Пользователи' : 'Магазины'}
          </button>
        ))}
      </div>

      {view === 'users' ? <UsersView onOpen={setSelectedUser} /> : <SellersView />}

      {selectedUser && (
        <UserDetailModal
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
          onChanged={loadOverview}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersView({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<'' | Plan>('');
  const [loading, setLoading] = useState(false);

  // Debounce the search box so we don't fire a request per keystroke.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, plan]);

  useEffect(() => {
    setLoading(true);
    adminApi
      .users({ search: debounced || undefined, plan: plan || undefined, page, limit: LIMIT })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [debounced, plan, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Пользователи · {fmt(total)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as '' | Plan)}
            style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', color: 'var(--text2)', fontFamily: 'inherit' }}
          >
            <option value="">Все тарифы</option>
            <option value="free">free</option>
            <option value="pro">pro</option>
          </select>
          <SearchField value={search} onChange={setSearch} placeholder="Поиск по email/имени…" ariaLabel="Поиск пользователей" />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Имя</th>
              <th style={thStyle}>Тариф</th>
              <th style={thStyle}>Роль</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Магазинов</th>
              <th style={thStyle}>Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} onClick={() => onOpen(u.id)} style={{ cursor: 'pointer' }} className="admin-row">
                <td style={tdStyle}>{u.email}</td>
                <td style={{ ...tdStyle, color: 'var(--text2)' }}>{u.name}</td>
                <td style={tdStyle}>{planBadge(u.plan)}</td>
                <td style={tdStyle}>{u.role === 'admin' ? <Badge tone="warn">admin</Badge> : <span style={{ color: 'var(--text3)' }}>user</span>}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{u.sellerCount}</td>
                <td style={{ ...tdStyle, color: 'var(--text2)' }}>{date(u.createdAt)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td style={{ ...tdStyle, color: 'var(--text3)' }} colSpan={6}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SellersView() {
  const [rows, setRows] = useState<AdminSellerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  useEffect(() => setPage(1), [status]);
  useEffect(() => {
    adminApi.sellers({ status: status || undefined, page, limit: LIMIT }).then((r) => {
      setRows(r.data);
      setTotal(r.total);
    });
  }, [status, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Магазины · {fmt(total)}</div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', color: 'var(--text2)', fontFamily: 'inherit' }}
        >
          <option value="">Все статусы</option>
          <option value="ok">ok</option>
          <option value="needs_reauth">needs reauth</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Магазин</th>
              <th style={thStyle}>Владелец</th>
              <th style={thStyle}>Статус</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Заказов</th>
              <th style={thStyle}>Последняя синхр.</th>
              <th style={thStyle}>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.name}</td>
                <td style={{ ...tdStyle, color: 'var(--text2)' }}>{s.ownerEmail ?? '—'}</td>
                <td style={tdStyle}>{statusBadge(s.cookieStatus)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(s.orders)}</td>
                <td style={{ ...tdStyle, color: 'var(--text2)' }}>{date(s.lastSyncAt)}</td>
                <td style={{ ...tdStyle, color: s.lastSyncError ? 'var(--coral600)' : 'var(--text3)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.lastSyncError ?? ''}>
                  {s.lastSyncError ?? '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td style={{ ...tdStyle, color: 'var(--text3)' }} colSpan={6}>Нет магазинов</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UserDetailModal({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminApi.user(userId).then(setDetail).catch((e) => setError(extractErrorMessage(e)));
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);

  const setPlan = async (plan: Plan) => {
    if (!detail || detail.plan === plan) return;
    setSaving(true);
    try {
      await adminApi.setPlan(userId, plan);
      setDetail({ ...detail, plan });
      onChanged();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {!detail && !error && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Загрузка…</div>}
        {error && <div style={{ color: 'var(--coral600)', fontSize: 12 }}>{error}</div>}
        {detail && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{detail.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{detail.email}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                  {detail.role === 'admin' && <Badge tone="warn">admin</Badge>} рег. {date(detail.createdAt)}
                </div>
              </div>
              <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
            </div>

            {/* Change plan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Тариф:</span>
              {(['free', 'pro'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  disabled={saving}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: saving ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: detail.plan === p ? 500 : 400,
                    background: detail.plan === p ? (p === 'pro' ? 'var(--purple600)' : '#1F1F1F') : '#fff',
                    color: detail.plan === p ? '#fff' : 'var(--text2)',
                    boxShadow: detail.plan === p ? 'none' : '0 0 0 0.5px rgba(0,0,0,0.12) inset',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Usage */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
              <span>Магазинов: <b style={{ color: 'var(--text)' }}>{detail.usage.sellers}</b></span>
              <span>Расчётов юнит-эк.: <b style={{ color: 'var(--text)' }}>{detail.usage.unitEconomicsCalcs}</b></span>
            </div>

            {/* Sellers */}
            <div className="card-title">Магазины</div>
            {detail.sellers.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Нет подключённых магазинов</div>
            ) : (
              detail.sellers.map((s) => (
                <div key={s.id} style={{ padding: '9px 0', borderTop: '0.5px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>UID {s.kaspiMerchantUid} · синхр. {date(s.lastSyncAt)}</div>
                    {s.lastSyncError && <div style={{ fontSize: 11, color: 'var(--coral600)', marginTop: 2 }}>{s.lastSyncError}</div>}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{fmt(s.orders)} зак. · {fmt(s.products)} тов.</span>
                    {statusBadge(s.cookieStatus)}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
