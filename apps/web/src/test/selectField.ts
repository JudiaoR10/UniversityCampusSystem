import { fireEvent, screen } from '@testing-library/react';

export function changeSelect(label: string | RegExp, value: string) {
  const labelled = screen.getByLabelText(label);
  const root = labelled.closest('.field-select') ?? labelled.parentElement;
  const native = root instanceof Element ? root.querySelector('select') : null;
  if (!(native instanceof HTMLSelectElement)) {
    throw new Error(`Select nativo não encontrado para ${String(label)}`);
  }
  fireEvent.change(native, { target: { value } });
}
