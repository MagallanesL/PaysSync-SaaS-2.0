import type { FormEvent } from "react";
import type { FeeRecord, PaymentMethod } from "../../../lib/academyBilling";
import { formatMembershipStatus, formatPaymentMethod } from "../../../lib/display";
import { Field, TextArea } from "../common/FormPrimitives";

export interface PaymentFormState {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  fee: FeeRecord | null;
  form: PaymentFormState;
  formError: string | null;
  canWrite: boolean;
  isPreviewMode: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (nextForm: PaymentFormState) => void;
}

export function PaymentModal({
  isOpen,
  fee,
  form,
  formError,
  canWrite,
  isPreviewMode,
  onClose,
  onSubmit,
  onFormChange
}: PaymentModalProps) {
  if (!isOpen || !fee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fee-modal-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="fee-modal-title" className="font-display text-lg text-text">
              Registrar pago
            </h2>
            <p className="mt-1 text-xs text-muted">
              Registra un pago total o parcial. El saldo y el estado se recalculan en el momento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3 text-sm">
          <div className="grid gap-3 rounded-brand border border-slate-700 bg-bg p-3 md:grid-cols-4">
            <Info label="Total" value={`$${fee.totalAmount}`} />
            <Info label="Pagado" value={`$${fee.amountPaid}`} />
            <Info label="Saldo" value={`$${fee.balance}`} />
            <Info label="Estado" value={formatMembershipStatus(fee.status)} />
          </div>

          <Field label="Monto a registrar" type="number" min="0" value={form.amount} onChange={(value) => onFormChange({ ...form, amount: value })} />
          <Field label="Fecha de pago" type="date" value={form.paymentDate} onChange={(value) => onFormChange({ ...form, paymentDate: value })} />
          <label className="grid gap-1">
            Metodo de pago
            <select
              value={form.paymentMethod}
              onChange={(event) => onFormChange({ ...form, paymentMethod: event.target.value as PaymentMethod })}
              className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
            >
              <option value="cash">{formatPaymentMethod("cash")}</option>
              <option value="transfer">{formatPaymentMethod("transfer")}</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <TextArea label="Nota" value={form.note} onChange={(value) => onFormChange({ ...form, note: value })} placeholder="Opcional" />

          {formError ? <p className="text-xs text-danger">{formError}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-brand border border-slate-600 px-3 py-2 text-muted">
              Cancelar
            </button>
            <button disabled={!canWrite || isPreviewMode} className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40">
              {isPreviewMode ? "Modo demo" : "Guardar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text">{value}</p>
    </div>
  );
}
