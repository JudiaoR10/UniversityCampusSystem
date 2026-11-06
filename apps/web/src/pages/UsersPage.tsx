import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AuthUser, RoleCode } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { Navigate } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';
import { AlertMessage } from '../components/AlertMessage';
import { ChipTabs, EmptyState, FormField, LoadingState, StatusPill } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { BanIcon, CheckIcon, IconActionButton, TableActions } from '../components/ActionButtons';
import { StatCard } from '../components/StatCard';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { roleLabels } from '../lib/labels';

function roleTone(role: AuthUser['role']) {
  if (role === 'ADMIN') return 'danger' as const;
  if (role === 'STUDENT') return 'success' as const;
  if (role === 'TECHNICIAN' || role === 'FINANCE') return 'warning' as const;
  return 'info' as const;
}

// Estudantes e docentes têm conta criada nas abas Estudantes/Docentes, por isso
// não aparecem em Utilizadores e perfis (incluindo as contas novas).
const staffRoles: RoleCode[] = ['TECHNICIAN', 'COORDINATOR', 'ADMIN', 'FINANCE'];
type RoleFilter = 'ALL' | RoleCode;

export function UsersPage() {
  const { api, user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'TECHNICIAN' as RoleCode });
  const allowed = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);
  const canCreate = user?.role === 'ADMIN';

  async function load() {
    const res = await api.users();
    setUsers(res.data);
  }

  useEffect(() => {
    if (!allowed) return;
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, allowed]);

  const staff = useMemo(() => users.filter((item) => staffRoles.includes(item.role)), [users]);

  const stats = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((item) => item.isActive).length,
    }),
    [staff],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((item) => {
      if (roleFilter !== 'ALL' && item.role !== roleFilter) return false;
      if (!needle) return true;
      return `${item.fullName} ${item.email} ${roleLabels[item.role]}`.toLowerCase().includes(needle);
    });
  }, [staff, query, roleFilter]);

  if (user && !allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createUser(form);
      setForm({ email: '', password: '', fullName: '', role: 'TECHNICIAN' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: AuthUser) {
    setError(null);
    try {
      await api.updateUser(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao actualizar conta');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Identidade"
        title="Utilizadores e perfis"
        description="Contas de gestão, coordenação, técnicos e finanças. Estudantes e docentes têm conta própria, criada em Estudantes ou Docentes."
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Contas" value={stats.total} hint="Acessos à plataforma" icon={<ModuleGlyph name="users" />} />
        <StatCard label="Activas" value={stats.active} hint="Podem entrar agora" icon={<ModuleGlyph name="dashboard" />} />
      </section>

      {error ? <AlertMessage tone="error" message={error} /> : null}

      {canCreate ? (
        <form onSubmit={onCreate} className="hero-panel grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <h2 className="section-title md:col-span-2 xl:col-span-5">Nova conta de acesso</h2>
          <FormField label="Nome completo">
            <input className="field-input" placeholder="Ex.: Ana Silva" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </FormField>
          <FormField label="Email">
            <input className="field-input" type="email" placeholder="ana@ujac.ac.mz" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </FormField>
          <FormField label="Password">
            <input className="field-input" type="password" minLength={8} placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </FormField>
          <FormField label="Papel">
            <SelectField
              value={form.role}
              onChange={(role) => setForm({ ...form, role: role as RoleCode })}
              options={staffRoles.map((role) => ({ value: role, label: roleLabels[role] }))}
            />
          </FormField>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? 'A criar…' : 'Criar conta'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="search-field flex-1">
          <span className="text-campus-teal" aria-hidden>
            <ModuleGlyph name="users" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome, email ou papel"
            aria-label="Procurar utilizadores"
          />
        </label>
        <ChipTabs
          items={[{ id: 'ALL' as RoleFilter, label: 'Todos' }, ...staffRoles.map((role) => ({ id: role as RoleFilter, label: roleLabels[role] }))]}
          value={roleFilter}
          onChange={setRoleFilter}
          ariaLabel="Filtrar por papel"
          className="lg:max-w-[62%]"
        />
      </div>

      {loading ? (
        <LoadingState label="A carregar utilizadores…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={staff.length === 0 ? 'Ainda não há contas' : 'Nenhum resultado'}
          description={staff.length === 0 ? 'Crie a primeira conta para abrir acesso à plataforma.' : 'Ajuste a pesquisa ou o filtro de papel.'}
        />
      ) : (
        <div className="table-scroll surface">
          <table className="min-w-[760px]">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Papel</th>
                <th>Estado</th>
                {canCreate ? <th className="text-right">Acções</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                return (
                  <tr key={item.id}>
                    <td className="font-medium text-campus-ink">{item.fullName}</td>
                    <td className="text-campus-deep/80">{item.email}</td>
                    <td>
                      <StatusPill tone={roleTone(item.role)}>{roleLabels[item.role]}</StatusPill>
                    </td>
                    <td>
                      <StatusPill tone={item.isActive ? 'success' : 'muted'}>
                        {item.isActive ? 'Activo' : 'Inactivo'}
                      </StatusPill>
                    </td>
                    {canCreate ? (
                      <td className="text-right">
                        <TableActions>
                          <IconActionButton
                            label={item.isActive ? 'Desactivar' : 'Activar'}
                            icon={item.isActive ? <BanIcon /> : <CheckIcon />}
                            tone={item.isActive ? 'danger' : 'success'}
                            onClick={() => void toggleActive(item)}
                          />
                        </TableActions>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
