/* ==========================================================================
   ui.js -- small shared helpers for building the interface by hand.
   ========================================================================== */

/**
 * Escapes text before it goes anywhere near innerHTML.
 *
 * Patient names, notes and emails are typed by users. Dropping raw input
 * into the DOM is how stored XSS happens -- one saved <script> tag and it
 * runs for every member of staff who opens the page.
 */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(message, kind = 'info') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());

  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'error' ? ' toast-error' : '');
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;

  document.body.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2800);
}

function notice(elementId, message, kind = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!message) {
    el.className = 'notice hidden';
    el.textContent = '';
    return;
  }
  el.className = `notice notice-${kind}`;
  el.textContent = message;
}

/** Locks a button while a request is in flight so it cannot be double-fired. */
function busy(button, isBusy, busyLabel = 'Working...') {
  if (!button) return;
  if (isBusy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

/**
 * Opens a modal built from a form definition.
 * Resolves with the submitted values, or null if the user cancelled.
 */
function openForm({ title, fields, values = {}, submitLabel = 'Save' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const body = fields.map((field) => {
      const value = values[field.name] ?? field.value ?? '';
      const required = field.required ? ' required' : '';

      let control;
      if (field.type === 'select') {
        const options = field.options.map((opt) => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          const selected = String(optValue) === String(value) ? ' selected' : '';
          return `<option value="${esc(optValue)}"${selected}>${esc(optLabel)}</option>`;
        }).join('');
        control = `<select id="f_${field.name}"${required}>${options}</select>`;
      } else if (field.type === 'textarea') {
        control = `<textarea id="f_${field.name}"${required}>${esc(value)}</textarea>`;
      } else {
        control = `<input id="f_${field.name}" type="${field.type || 'text'}" value="${esc(value)}"${required}
          ${field.min !== undefined ? `min="${field.min}"` : ''}
          ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''}>`;
      }

      return `<div class="field">
        <label for="f_${field.name}">${esc(field.label)}</label>
        ${control}
        ${field.hint ? `<p class="hint">${esc(field.hint)}</p>` : ''}
      </div>`;
    }).join('');

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">${esc(title)}</div>
        <div class="modal-body">
          <div id="modalNotice" class="notice hidden"></div>
          <form id="modalForm" novalidate>${body}</form>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-quiet" id="modalCancel">Cancel</button>
          <button type="button" class="btn" id="modalSave">${esc(submitLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    backdrop.querySelector('input, select, textarea')?.focus();

    function close(result) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }

    function onKey(event) { if (event.key === 'Escape') close(null); }

    function submit() {
      const result = {};
      for (const field of fields) {
        const input = backdrop.querySelector(`#f_${field.name}`);
        let value = input.value.trim();

        if (field.required && !value) {
          notice('modalNotice', `${field.label} is required.`);
          input.focus();
          return;
        }
        if (field.type === 'number' && value !== '') value = Number(value);
        result[field.name] = value;
      }
      close(result);
    }

    backdrop.querySelector('#modalSave').addEventListener('click', submit);
    backdrop.querySelector('#modalCancel').addEventListener('click', () => close(null));
    backdrop.querySelector('#modalForm').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    document.addEventListener('keydown', onKey);
  });
}

/** Yes/no confirmation, used before anything destructive. */
function confirmAction(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:400px">
        <div class="modal-head">Are you sure?</div>
        <div class="modal-body"><p style="margin:0">${esc(message)}</p></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-quiet" id="cancelBtn">Keep it</button>
          <button type="button" class="btn btn-danger" id="okBtn">${esc(confirmLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    backdrop.querySelector('#okBtn').focus();

    const done = (v) => { backdrop.remove(); resolve(v); };
    backdrop.querySelector('#okBtn').addEventListener('click', () => done(true));
    backdrop.querySelector('#cancelBtn').addEventListener('click', () => done(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) done(false); });
  });
}

function money(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function prettyDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Today as YYYY-MM-DD, in local time rather than UTC. */
function todayISO() {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
