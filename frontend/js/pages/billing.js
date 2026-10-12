/* Billing -- bills and payment status. */

const BillingPage = {
  title: 'Billing',
  subtitle: 'Bills raised against patient visits.',

  async render(view, user) {
    const canRaise  = can(user, 'admin', 'billing');
    const canDelete = can(user, 'admin');

    let bills = [];
    let patients = [];

    view.innerHTML = `
      <div class="toolbar">
        <select id="statusFilter" aria-label="Filter by payment status">
          <option value="">All bills</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <div class="stats" id="stats"></div>
      <section class="panel">
        <div class="table-scroll" id="list"><div class="empty">Loading...</div></div>
      </section>`;

    if (canRaise) {
      setHeadActions('<button type="button" class="btn" id="newBtn">New bill</button>');
      document.getElementById('newBtn').addEventListener('click', createBill);
    }

    document.getElementById('statusFilter').addEventListener('change', load);

    await load();

    async function load() {
      const status = document.getElementById('statusFilter').value;
      try {
        bills = await API.get(`/billing/${status ? '?status=' + status : ''}`);
        drawStats();
        drawList();
      } catch (err) {
        document.getElementById('list').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      }
    }

    function drawStats() {
      const billed = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
      const collected = bills.filter((b) => b.paymentStatus === 'paid')
                             .reduce((sum, b) => sum + (b.amount || 0), 0);

      document.getElementById('stats').innerHTML = `
        <div class="stat">
          <div class="stat-label">Billed</div>
          <div class="stat-value">${esc(money(billed))}</div>
          <div class="stat-note">${bills.length} bill${bills.length === 1 ? '' : 's'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Collected</div>
          <div class="stat-value">${esc(money(collected))}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">${esc(money(billed - collected))}</div>
        </div>`;
    }

    function drawList() {
      const list = document.getElementById('list');

      if (bills.length === 0) {
        list.innerHTML = `<div class="empty">${
          canRaise ? 'No bills here yet. Raise the first one.' : 'No bills here yet.'
        }</div>`;
        return;
      }

      const sorted = [...bills].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      list.innerHTML = `
        <table>
          <thead>
            <tr><th>Raised</th><th>Patient</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${sorted.map((b) => `
              <tr>
                <td class="num">${esc(prettyDate(b.createdAt))}</td>
                <td><strong>${esc(b.patientName || '--')}</strong></td>
                <td>${esc(b.description || '--')}</td>
                <td class="num">${esc(money(b.amount))}</td>
                <td><span class="pill ${b.paymentStatus === 'paid' ? 'pill-ok' : 'pill-danger'}">${esc(b.paymentStatus)}</span></td>
                <td><div class="row-actions">
                  ${canRaise ? `<button class="btn btn-quiet btn-small" data-toggle="${b._id}">${
                    b.paymentStatus === 'paid' ? 'Mark unpaid' : 'Mark paid'}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-danger btn-small" data-delete="${b._id}">Delete</button>` : ''}
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      list.querySelectorAll('[data-toggle]').forEach((b) =>
        b.addEventListener('click', () => togglePaid(b.dataset.toggle)));
      list.querySelectorAll('[data-delete]').forEach((b) =>
        b.addEventListener('click', () => deleteBill(b.dataset.delete)));
    }

    async function createBill() {
      try {
        if (patients.length === 0) patients = await API.get('/patients/');
      } catch (err) {
        toast(err.message, 'error');
        return;
      }

      if (patients.length === 0) {
        toast('Register a patient before raising a bill.', 'error');
        return;
      }

      const values = await openForm({
        title: 'New bill',
        submitLabel: 'Raise bill',
        fields: [
          { name: 'patientId', label: 'Patient', type: 'select', required: true,
            options: patients.map((p) => ({ value: p._id, label: p.name })) },
          { name: 'description', label: 'What is this for', required: true, placeholder: 'Consultation' },
          { name: 'amount', label: 'Amount', type: 'number', min: 0, required: true }
        ]
      });
      if (!values) return;

      const patient = patients.find((p) => p._id === values.patientId);

      try {
        await API.post('/billing/', {
          patientId: values.patientId,
          patientName: patient.name,
          description: values.description,
          amount: values.amount
        });
        toast('Bill created.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function togglePaid(id) {
      const bill = bills.find((b) => b._id === id);
      if (!bill) return;
      try {
        await API.put(`/billing/${id}`, {
          paymentStatus: bill.paymentStatus === 'paid' ? 'unpaid' : 'paid'
        });
        toast('Bill updated.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteBill(id) {
      const ok = await confirmAction('This bill will be removed permanently.');
      if (!ok) return;
      try {
        await API.delete(`/billing/${id}`);
        toast('Bill deleted.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  }
};
