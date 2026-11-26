/** Drobne elementy interfejsu edytora: okno dialogowe, komunikat, escape HTML. */

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

type Action = { value: string; label: string; kind?: 'primary' | 'danger' };
export type ModalResult = { action: string; data: Record<string, string | boolean>; files: Record<string, File | undefined> };

/** Okno z formularzem. Zwraca wartości pól albo null (Anuluj / Esc). */
export function modal(opts: { title: string; body: string; actions?: Action[]; wide?: boolean; cancel?: string | false }): Promise<ModalResult | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'adm-modal' + (opts.wide ? ' adm-modal--wide' : '');
    const actions = opts.actions ?? [{ value: 'ok', label: 'OK', kind: 'primary' }];
    dlg.innerHTML = `
      <form method="dialog">
        <h2>${esc(opts.title)}</h2>
        <div class="adm-modal__body">${opts.body}</div>
        <div class="adm-modal__actions">
          ${opts.cancel === false ? '' : `<button type="button" data-cancel>${esc(opts.cancel ?? 'Anuluj')}</button>`}
          ${actions.map((a) => `<button value="${esc(a.value)}" class="${a.kind ?? ''}" ${a.kind === 'danger' ? 'formnovalidate' : ''}>${esc(a.label)}</button>`).join('')}
        </div>
      </form>`;
    document.body.append(dlg);
    const form = dlg.querySelector('form')!;
    let done = false;
    const finish = (r: ModalResult | null) => {
      if (done) return;
      done = true;
      dlg.close();
      dlg.remove();
      resolve(r);
    };
    dlg.querySelector('[data-cancel]')?.addEventListener('click', () => finish(null));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(null);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      const data: Record<string, string | boolean> = {};
      const files: Record<string, File | undefined> = {};
      for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]')) {
        if (el instanceof HTMLInputElement && el.type === 'checkbox') data[el.name] = el.checked;
        else if (el instanceof HTMLInputElement && el.type === 'file') files[el.name] = el.files?.[0];
        else data[el.name] = el.value;
      }
      finish({ action: submitter?.value || actions[actions.length - 1].value, data, files });
    });
    dlg.showModal();
    dlg.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=file]), textarea, select')?.focus();
  });
}

export async function confirmBox(title: string, text: string, ok = 'OK', kind: 'primary' | 'danger' = 'primary') {
  const r = await modal({ title, body: `<p>${text}</p>`, actions: [{ value: 'ok', label: ok, kind }] });
  return !!r;
}

let toastTimer: number | undefined;
export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  let el = document.querySelector<HTMLElement>('.adm-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'adm-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.dataset.kind = kind;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('is-visible'), kind === 'error' ? 8000 : 2500);
}
