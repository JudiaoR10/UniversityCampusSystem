import { useEffect, useState, type FormEvent } from "react";
import type { DebtDto, DebtOrigin, DebtStatus } from "@smart-campus/shared-types";
import { DEBT_ORIGINS } from "@smart-campus/shared-types";
import { useAuth } from "../../lib/auth";
import { BusyLabel, LoadState, SuccessFeedback } from "./shared";
import { SelectField } from "../SelectField";
import { BanIcon, IconActionButton, TableActions } from "../ActionButtons";

const ORIGIN_LABELS: Record<DebtOrigin, string> = {
  TUITION: "Propina",
  FEE: "Taxa",
  FINE: "Multa",
  OTHER: "Outra",
};

export function FinancialDebts({ studentId }: { studentId?: string }) {
  const { api, user } = useAuth();
  const [debts, setDebts] = useState<DebtDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<DebtStatus | "">("");
  const [origin, setOrigin] = useState<DebtOrigin | "">("");
  const [dueBefore, setDueBefore] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DebtDto | null>(null);
  const allowed = !!user && ["STUDENT", "FINANCE", "ADMIN"].includes(user.role);
  const canManage = user?.role === "FINANCE";
  const canContest = user?.role === "STUDENT";
  const manager = !!user && ["FINANCE", "ADMIN"].includes(user.role);
  const campus = manager && !studentId;
  const query = {
    studentId,
    offset,
    limit: 20,
    status: status || undefined,
    origin: origin || undefined,
    dueBefore: dueBefore ? new Date(`${dueBefore}T23:59:59`).toISOString() : undefined,
  };
  async function reload() {
    const res = await api.financialDebts(query);
    setDebts(res.data);
  }
  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    let active = true;
    setSelected(null);
    setLoading(true);
    setError("");

    api
      .financialDebts(query)
      .then((res) => {
        if (active) setDebts(res.data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, allowed, offset, studentId, status, origin, dueBefore]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "debt" | "payment" | "analysis",
  ) {
    event.preventDefault();
    if (!studentId && kind === "debt") return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (kind === "debt")
        await api.createDebt({
          ...fields,
          studentId,
          amount: Number(fields.amount),
          dueDate: new Date(String(fields.dueDate)).toISOString(),
        });
      if (kind === "payment" && selected)
        await api.createPayment({
          ...fields,
          debtId: selected.id,
          amountPaid: selected.amount,
        });
      if (kind === "analysis" && selected)
        await api.createAnalysisRequest({ ...fields, debtId: selected.id });
      form.reset();
      setSelected(null);
      setMessage("Operação concluída.");
      await reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel(debt: DebtDto) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.cancelDebt(debt.id);
      setSelected(null);
      setMessage("Dívida cancelada.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cancelar a dívida.");
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return <p className="surface p-4 text-sm text-campus-deep sm:p-5">O seu perfil não tem acesso à gestão financeira.</p>;
  return (
    <div className="space-y-6">
      <SuccessFeedback message={message} onClose={() => setMessage("")} />
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <LoadState loading={loading} error="" reload={() => void reload()} label="A carregar dívidas…" />
      <form data-financial-guide="debt-filters" className="surface grid gap-4 p-4 sm:p-5 md:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
        <h2 className="font-display text-xl font-semibold text-campus-ink md:col-span-3">
          {campus ? "Dívidas do campus" : "Filtros"}
        </h2>
        <label className="min-w-0 text-sm font-medium">
          Estado
          <SelectField
            value={status}
            disabled={busy}
            onChange={(value) => { setStatus(value as DebtStatus | ""); setOffset(0); }}
            options={[
              { value: "", label: "Todos" },
              { value: "PENDENTE", label: "Pendente" },
              { value: "VENCIDA", label: "Vencida" },
              { value: "REGULARIZADA", label: "Regularizada" },
              { value: "CANCELADA", label: "Cancelada" },
            ]}
          />
        </label>
        <label className="min-w-0 text-sm font-medium">
          Origem
          <SelectField
            value={origin}
            disabled={busy}
            onChange={(value) => { setOrigin(value as DebtOrigin | ""); setOffset(0); }}
            options={[{ value: "", label: "Todas" }, ...DEBT_ORIGINS.map((value) => ({ value, label: ORIGIN_LABELS[value] }))]}
          />
        </label>
        <label className="min-w-0 text-sm font-medium">
          Vence até
          <input
            className="field-input"
            type="date"
            value={dueBefore}
            disabled={busy}
            onChange={(event) => { setDueBefore(event.target.value); setOffset(0); }}
          />
        </label>
      </form>
      {canManage && studentId && (
        <form
          data-financial-guide="debt-create"
          className="surface grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(e) => void submit(e, "debt")}
        >
          <h2 className="font-display text-xl font-semibold text-campus-ink md:col-span-2 xl:col-span-3">Nova dívida</h2>
          <label className="min-w-0 text-sm font-medium">
            Descrição{" "}
            <input className="field-input" name="title" required minLength={3} maxLength={120} />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Valor (MZN){" "}
            <input
              className="field-input"
              name="amount"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              required
            />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Origem{" "}
            <SelectField
              name="origin"
              defaultValue="TUITION"
              options={DEBT_ORIGINS.map((value) => ({ value, label: ORIGIN_LABELS[value] }))}
            />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Vencimento{" "}
            <input
              className="field-input"
              name="dueDate"
              type="datetime-local"
              required
            />
          </label>
          <button
            disabled={busy}
            className="btn-primary w-full self-end md:col-span-2 md:w-auto md:justify-self-start xl:col-span-1"
          >
            <BusyLabel busy={busy} busyText="A registar…">Registar dívida</BusyLabel>
          </button>
        </form>
      )}
      {!loading && !error ? (
        <>
          <div data-financial-guide="debt-list" className="surface table-scroll">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="px-4 py-4 text-left font-display text-xl font-semibold text-campus-ink">
                Dívidas — página {offset / 20 + 1}
              </caption>
              <thead className="bg-campus-mist/80 text-campus-deep">
                <tr>
                  {[
                    ...(campus ? ["Estudante"] : []),
                    "Descrição",
                    "Origem",
                    "Valor (MZN)",
                    "Vencimento",
                    "Estado",
                    "Acção",
                  ].map((label) => (
                    <th scope="col" className="px-4 py-3 font-semibold" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debts.map((debt) => (
                  <tr key={debt.id} className="border-t border-campus-line/70">
                    {campus && (
                      <td className="px-4 py-3">{debt.student?.fullName ?? debt.studentId}</td>
                    )}
                    <td className="px-4 py-3 font-medium">{debt.title}</td>
                    <td className="px-4 py-3">{ORIGIN_LABELS[debt.origin as DebtOrigin] ?? debt.origin}</td>
                    <td className="px-4 py-3 tabular-nums">{debt.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {new Date(debt.dueDate).toLocaleDateString("pt-MZ")}
                    </td>
                    <td className="px-4 py-3">{debt.status}</td>
                    <td className="px-4 py-3">
                      {["PENDENTE", "VENCIDA"].includes(debt.status) && (canManage || canContest) && (
                        <TableActions>
                          <IconActionButton
                            label={canManage ? "Registar pagamento" : "Contestar"}
                            disabled={busy}
                            onClick={() => setSelected(debt)}
                          />
                          {canManage && (
                            <IconActionButton
                              label="Cancelar dívida"
                              icon={<BanIcon />}
                              danger
                              disabled={busy}
                              onClick={() => void cancel(debt)}
                            />
                          )}
                        </TableActions>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!debts.length && <p className="text-sm text-campus-deep/75">Não existem dívidas nesta página.</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || offset === 0}
              onClick={() => setOffset((n) => n - 20)}
            >
              Anterior
            </button>
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || debts.length < 20}
              onClick={() => setOffset((n) => n + 20)}
            >
              Seguinte
            </button>
          </div>
        </>
      ) : null}
      {selected && (
        <form
          className="surface grid gap-4 p-4 sm:p-5 md:grid-cols-2"
          onSubmit={(e) => void submit(e, canManage ? "payment" : "analysis")}
        >
          <h2 className="break-words font-display text-xl font-semibold text-campus-ink md:col-span-2">
            {selected.title} — {selected.amount.toFixed(2)} MZN
          </h2>
          {canManage ? (
            <>
              <label className="min-w-0 text-sm font-medium">
                Método{" "}
                <SelectField
                  name="paymentMethod"
                  defaultValue="BANK_TRANSFER"
                  options={[
                    { value: "BANK_TRANSFER", label: "Transferência bancária" },
                    { value: "CASH_DEPOSIT", label: "Depósito" },
                    { value: "MOBILE_MONEY", label: "Carteira móvel" },
                    { value: "POS", label: "POS" },
                  ]}
                />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Referência{" "}
                <input
                  name="referenceCode"
                  required
                  minLength={4}
                  maxLength={80}
                  className="field-input"
                />
              </label>
            </>
          ) : (
            <label className="min-w-0 text-sm font-medium md:col-span-2">
              Justificação{" "}
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                className="field-input min-h-28 resize-y"
              />
            </label>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap md:col-span-2">
            <button disabled={busy} className="btn-primary">
              <BusyLabel busy={busy} busyText="A processar…">{canManage ? "Confirmar pagamento integral" : "Submeter contestação"}</BusyLabel>
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setSelected(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
