/* Doctors -- only an admin can change the directory. */

const DoctorsPage = {
  title: 'Doctors',
  subtitle: 'The consulting staff and their specialisations.',

  async render(view, user) {
    const canManage = can(user, 'admin');
    let doctors = [];

    view.innerHTML = `
      <div class="toolbar">
        <input type="search" id="search" placeholder="Search by name or specialisation" aria-label="Search doctors">
      </div>
      <section class="panel">
        <div class="table-scroll" id="list"><div class="empty">Loading...</div></div>
      </section>`;

    if (canManage) {
      setHeadActions('<button type="button" class="btn" id="addBtn">Add doctor</button>');
      document.getElementById('addBtn').addEventListener('click', addDoctor);
    }

    document.getElementById('search').addEventListener('input', draw);

    await load();

    async function load() {
      try {
        doctors = await API.get('/doctors/');
        draw();
      } catch (err) {
        document.getElementById('list').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      }
    }

    function draw() {
      const term = document.getElementById('search').value.trim().toLowerCase();

      const rows = doctors.filter((d) =>
        !term ||
        (d.name || '').toLowerCase().includes(term) ||
        (d.specialization || '').toLowerCase().includes(term));

      const list = document.getElementById('list');

      if (rows.length === 0) {
        list.innerHTML = `<div class="empty">${
          doctors.length === 0 ? 'No doctors listed yet.' : 'No doctor matches that search.'
        }</div>`;
        return;
      }

      list.innerHTML = `
        <table>
          <thead>
            <tr><th>Name</th><th>Specialisation</th><th>Experience</th><th>Phone</th><th>Email</th><th></th></tr>
          </thead>
          <tbody>
            ${rows.map((d) => `
              <tr>
                <td><strong>${esc(d.name)}</strong></td>
                <td>${esc(d.specialization)}</td>
                <td>${esc(d.experience || '--')}</td>
                <td class="num">${esc(d.phone || '--')}</td>
                <td>${esc(d.email || '--')}</td>
                <td><div class="row-actions">${
                  canManage
                    ? `<button class="btn btn-quiet btn-small" data-edit="${d._id}">Edit</button>
                       <button class="btn btn-danger btn-small" data-delete="${d._id}">Delete</button>`
                    : ''
                }</div></td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      list.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => editDoctor(b.dataset.edit)));
      list.querySelectorAll('[data-delete]').forEach((b) =>
        b.addEventListener('click', () => removeDoctor(b.dataset.delete)));
    }

    const FIELDS = [
      { name: 'name', label: 'Full name', required: true },
      { name: 'specialization', label: 'Specialisation', required: true, placeholder: 'Cardiology' },
      { name: 'experience', label: 'Experience', placeholder: '8 years' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' }
    ];

    async function addDoctor() {
      const values = await openForm({ title: 'Add doctor', fields: FIELDS, submitLabel: 'Add doctor' });
      if (!values) return;
      try {
        await API.post('/doctors/', values);
        toast('Doctor saved.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function editDoctor(id) {
      const doctor = doctors.find((d) => d._id === id);
      if (!doctor) return;

      const values = await openForm({
        title: `Edit ${doctor.name}`, fields: FIELDS, values: doctor, submitLabel: 'Save changes'
      });
      if (!values) return;

      try {
        await API.put(`/doctors/${id}`, values);
        toast('Doctor updated.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function removeDoctor(id) {
      const doctor = doctors.find((d) => d._id === id);
      if (!doctor) return;

      const ok = await confirmAction(`${doctor.name} will be removed from the directory.`);
      if (!ok) return;

      try {
        await API.delete(`/doctors/${id}`);
        toast('Doctor deleted.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  }
};
