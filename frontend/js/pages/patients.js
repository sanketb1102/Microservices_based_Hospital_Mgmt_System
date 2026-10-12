/* Patients -- list, add, edit, delete. */

const PatientsPage = {
  title: 'Patients',
  subtitle: 'Every patient registered at this hospital.',

  async render(view, user) {
    // Mirrors authorize('admin','receptionist') on the patient service.
    const canWrite  = can(user, 'admin', 'receptionist');
    const canDelete = can(user, 'admin');

    let patients = [];

    view.innerHTML = `
      <div class="toolbar">
        <input type="search" id="search" placeholder="Search by name or phone" aria-label="Search patients">
      </div>
      <section class="panel">
        <div class="table-scroll" id="list"><div class="empty">Loading...</div></div>
      </section>`;

    if (canWrite) {
      setHeadActions('<button type="button" class="btn" id="addBtn">Add patient</button>');
      document.getElementById('addBtn').addEventListener('click', addPatient);
    }

    document.getElementById('search').addEventListener('input', draw);

    await load();

    async function load() {
      try {
        patients = await API.get('/patients/');
        draw();
      } catch (err) {
        document.getElementById('list').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      }
    }

    function draw() {
      const term = document.getElementById('search').value.trim().toLowerCase();

      const rows = patients.filter((p) =>
        !term || (p.name || '').toLowerCase().includes(term) || (p.phone || '').includes(term));

      const list = document.getElementById('list');

      if (rows.length === 0) {
        list.innerHTML = `<div class="empty">${
          patients.length === 0
            ? (canWrite ? 'No patients yet. Add the first one.' : 'No patients registered yet.')
            : 'No patient matches that search.'
        }</div>`;
        return;
      }

      list.innerHTML = `
        <table>
          <thead>
            <tr><th>Name</th><th>Age</th><th>Gender</th><th>Blood</th><th>Phone</th><th>Email</th><th></th></tr>
          </thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody>
        </table>`;

      list.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => editPatient(b.dataset.edit)));
      list.querySelectorAll('[data-delete]').forEach((b) =>
        b.addEventListener('click', () => deletePatient(b.dataset.delete)));
    }

    function rowHtml(p) {
      const actions = [];
      if (canWrite)  actions.push(`<button class="btn btn-quiet btn-small" data-edit="${p._id}">Edit</button>`);
      if (canDelete) actions.push(`<button class="btn btn-danger btn-small" data-delete="${p._id}">Delete</button>`);

      return `<tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td class="num">${esc(p.age)}</td>
        <td>${esc(p.gender || '--')}</td>
        <td>${p.bloodGroup ? `<span class="pill pill-neutral">${esc(p.bloodGroup)}</span>` : '--'}</td>
        <td class="num">${esc(p.phone || '--')}</td>
        <td>${esc(p.email || '--')}</td>
        <td><div class="row-actions">${actions.join('')}</div></td>
      </tr>`;
    }

    const FIELDS = [
      { name: 'name', label: 'Full name', required: true },
      { name: 'age',  label: 'Age', type: 'number', min: 0, required: true },
      { name: 'gender', label: 'Gender', type: 'select',
        options: [{ value: '', label: 'Not recorded' }, 'Male', 'Female', 'Other'] },
      { name: 'bloodGroup', label: 'Blood group', type: 'select',
        options: [{ value: '', label: 'Not recorded' }, 'A+','A-','B+','B-','AB+','AB-','O+','O-'] },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' }
    ];

    async function addPatient() {
      const values = await openForm({ title: 'Add patient', fields: FIELDS, submitLabel: 'Add patient' });
      if (!values) return;
      try {
        await API.post('/patients/', values);
        toast('Patient saved.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function editPatient(id) {
      const patient = patients.find((p) => p._id === id);
      if (!patient) return;

      const values = await openForm({
        title: `Edit ${patient.name}`, fields: FIELDS, values: patient, submitLabel: 'Save changes'
      });
      if (!values) return;

      try {
        await API.put(`/patients/${id}`, values);
        toast('Patient updated.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deletePatient(id) {
      const patient = patients.find((p) => p._id === id);
      if (!patient) return;

      const ok = await confirmAction(`${patient.name}'s record will be removed permanently.`);
      if (!ok) return;

      try {
        await API.delete(`/patients/${id}`);
        toast('Patient deleted.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  }
};
