import { useEffect, useState, type FormEvent } from "react";
import type { DebtDto } from "@smart-campus/shared-types";
import { useAuth } from "../../lib/auth";


export function FinancialDebts({ studentId }: { studentId: string }) {
  const { api, user } = useAuth();
  const [debts, setDebts] = useState<DebtDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DebtDto | null>(null);
  const allowed = !!user && ["STUDENT", "FINANCE", "ADMIN"].includes(user.role);
  const manager = !!user && ["FINANCE", "ADMIN"].includes(user.role);
  async function reload() {
    const res = await api.financialDebts({ studentId, offset, limit: 20 });
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
      .financialDebts({ studentId, offset, limit: 20 })
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
  }, [api, allowed, offset, studentId]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "debt" | "payment" | "analysis",
  ) {
    event.preventDefault();
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
  if (!allowed)
    return <p className="surface p-4 text-sm text-campus-deep sm:p-5">O seu perfil não tem acesso à gestão financeira.</p>;
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? <p role="status" className="surface p-4 text-sm text-campus-deep/75">A carregar dívidas...</p> : null}
      {message && <p role="status" className="rounded-xl bg-campus-teal/10 px-3 py-2 text-sm text-campus-teal">{message}</p>}
      {manager && (
        <form
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
            <input
              className="field-input"
              name="origin"
              defaultValue="TUITION"
              minLength={2}
              maxLength={60}
              required
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
            Registar dívida
          </button>
        </form>
      )}
      {!loading && !error ? (
        <>
          <div className="surface table-scroll">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="px-4 py-4 text-left font-display text-xl font-semibold text-campus-ink">
                Dívidas — página {offset / 20 + 1}
              </caption>
              <thead className="bg-campus-mist/80 text-campus-deep">
                <tr>
                  {[
                    "Descrição",
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
                    <td className="px-4 py-3 font-medium">{debt.title}</td>
                    <td className="px-4 py-3 tabular-nums">{debt.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {new Date(debt.dueDate).toLocaleDateString("pt-MZ")}
                    </td>
                    <td className="px-4 py-3">{debt.status}</td>
                    <td className="px-4 py-3">
                      {["PENDENTE", "VENCIDA"].includes(debt.status) && (
                        <button
                          disabled={busy}
                          className="btn-secondary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => setSelected(debt)}
                        >
                          {manager ? "Registar pagamento" : "Contestar"}
                        </button>
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
          onSubmit={(e) => void submit(e, manager ? "payment" : "analysis")}
        >
          <h2 className="break-words font-display text-xl font-semibold text-campus-ink md:col-span-2">
            {selected.title} — {selected.amount.toFixed(2)} MZN
          </h2>
          {manager ? (
            <>
              <label className="min-w-0 text-sm font-medium">
                Método{" "}
                <select className="field-input" name="paymentMethod">
                  <option value="BANK_TRANSFER">Transferência bancária</option>
                  <option value="CASH_DEPOSIT">Depósito</option>
                  <option value="MOBILE_MONEY">Carteira móvel</option>
                  <option value="POS">POS</option>
                </select>
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
              {manager ? "Confirmar pagamento integral" : "Submeter contestação"}
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
