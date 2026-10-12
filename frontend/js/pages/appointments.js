/* Appointments -- booking, visit notes and outcomes. */

const AppointmentsPage = {
  title: 'Appointments',
  subtitle: 'Bookings, visit notes and outcomes.',

  async render(view, user) {
    const canBook   = can(user, 'admin', 'receptionist');
    const canChart  = can(user, 'admin', 'doctor');   // vitals, notes, prescription
    const canDelete = can(user, 'admin');

    let appointments = [];
    let patients = [];
    let doctors = [];

    view.innerHTML = `
      <div class="toolbar">
        <input type="date" id="dateFilter" aria-label="Filter by date">
        <select id="statusFilter" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="button" class="btn btn-quiet" id="clearFilters">Clear filters</button>
      </div>
      <section class="panel">
        <div class="table-scroll" id="list"><div class="empty">Loading...</div></div>
      </section>`;

    if (canBook) {
      setHeadActions('<button type="button" class="btn" id="bookBtn">Book appointment</button>');
      document.getElementById('bookBtn').addEventListener('click', bookAppointment);
    }

    document.getElementById('dateFilter').addEventListener('change', load);
    document.getElementById('statusFilter').addEventListener('change', load);
    document.getElementById('clearFilters').addEventListener('click', () => {
      document.getElementById('dateFilter').value = '';
      document.getElementById('statusFilter').value = '';
      load();
    });

    await load();

    async function load() {
      const params = new URLSearchParams();
      const date = document.getElementById('dateFilter').value;
      const status = document.getElementById('statusFilter').value;
      if (date) params.set('date', date);
      if (status) params.set('status', status);
      const query = params.toString();

      try {
        // The appointment schema stores only patientId and doctorId, so the
        // names are resolved here by loading both lists once and mapping.
        const [appts, pats, docs] = await Promise.all([
          API.get(`/appointments/${query ? '?' + query : ''}`),
          API.get('/patients/'),
          API.get('/doctors/')
        ]);
        appointments = appts;
        patients = pats;
        doctors = docs;
        draw();
      } catch (err) {
        document.getElementById('list').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      }
    }

    const nameOf = (list, id) => {
      const found = list.find((x) => x._id === id);
      return found ? found.name : 'Unknown';
    };

    const STATUS_STYLE = { scheduled: 'pill-neutral', completed: 'pill-ok', cancelled: 'pill-danger' };

    function draw() {
      const list = document.getElementById('list');

      if (appointments.length === 0) {
        list.innerHTML = `<div class="empty">${
          canBook ? 'Nothing booked for this filter. Book an appointment to start.' : 'Nothing booked for this filter.'
        }</div>`;
        return;
      }

      const sorted = [...appointments].sort((a, b) =>
        (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

      list.innerHTML = `
        <table>
          <thead>
            <tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${sorted.map((a) => `
              <tr>
                <td class="num">${esc(prettyDate(a.date))}</td>
                <td class="num">${esc(a.time || '--')}</td>
                <td><strong>${esc(nameOf(patients, a.patientId))}</strong></td>
                <td>${esc(nameOf(doctors, a.doctorId))}</td>
                <td>${esc(a.reason || '--')}</td>
                <td><span class="pill ${STATUS_STYLE[a.status] || 'pill-neutral'}">${esc(a.status)}</span></td>
                <td><div class="row-actions">
                  ${canChart ? `<button class="btn btn-quiet btn-small" data-chart="${a._id}">Visit notes</button>` : ''}
                  ${canBook ? `<button class="btn btn-quiet btn-small" data-status="${a._id}">Status</button>` : ''}
                  ${canDelete ? `<button class="btn btn-danger btn-small" data-delete="${a._id}">Delete</button>` : ''}
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      list.querySelectorAll('[data-chart]').forEach((b) =>
        b.addEventListener('click', () => editVisit(b.dataset.chart)));
      list.querySelectorAll('[data-status]').forEach((b) =>
        b.addEventListener('click', () => changeStatus(b.dataset.status)));
      list.querySelectorAll('[data-delete]').forEach((b) =>
        b.addEventListener('click', () => deleteAppointment(b.dataset.delete)));
    }

    async function bookAppointment() {
      if (patients.length === 0) { toast('Register a patient before booking.', 'error'); return; }
      if (doctors.length === 0)  { toast('Add a doctor before booking.', 'error'); return; }

      const values = await openForm({
        title: 'Book appointment',
        submitLabel: 'Book it',
        fields: [
          { name: 'patientId', label: 'Patient', type: 'select', required: true,
            options: patients.map((p) => ({ value: p._id, label: `${p.name} (${p.age})` })) },
          { name: 'doctorId', label: 'Doctor', type: 'select', required: true,
            options: doctors.map((d) => ({ value: d._id, label: `${d.name} - ${d.specialization}` })) },
          { name: 'date', label: 'Date', type: 'date', required: true, value: todayISO() },
          { name: 'time', label: 'Time', type: 'time', required: true, value: '10:00' },
          { name: 'reason', label: 'Reason for visit', type: 'textarea' }
        ]
      });
      if (!values) return;

      try {
        await API.post('/appointments/', values);
        toast('Appointment booked.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function editVisit(id) {
      const appointment = appointments.find((a) => a._id === id);
      if (!appointment) return;

      const vitals = appointment.vitals || {};

      const values = await openForm({
        title: `Visit notes - ${nameOf(patients, appointment.patientId)}`,
        submitLabel: 'Save notes',
        values: {
          bp: vitals.bp, pulse: vitals.pulse, temp: vitals.temp, weight: vitals.weight,
          clinicalNotes: appointment.clinicalNotes,
          prescription: appointment.prescription
        },
        fields: [
          { name: 'bp', label: 'Blood pressure', placeholder: '120/80' },
          { name: 'pulse', label: 'Pulse (bpm)' },
          { name: 'temp', label: 'Temperature' },
          { name: 'weight', label: 'Weight (kg)' },
          { name: 'clinicalNotes', label: 'Clinical notes', type: 'textarea' },
          { name: 'prescription', label: 'Prescription', type: 'textarea' }
        ]
      });
      if (!values) return;

      try {
        await API.put(`/appointments/${id}`, {
          vitals: { bp: values.bp, pulse: values.pulse, temp: values.temp, weight: values.weight },
          clinicalNotes: values.clinicalNotes,
          prescription: values.prescription
        });
        toast('Visit notes saved.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function changeStatus(id) {
      const appointment = appointments.find((a) => a._id === id);
      if (!appointment) return;

      const values = await openForm({
        title: 'Update status',
        submitLabel: 'Update',
        values: { status: appointment.status },
        fields: [{ name: 'status', label: 'Status', type: 'select',
                   options: ['scheduled', 'completed', 'cancelled'] }]
      });
      if (!values) return;

      try {
        await API.put(`/appointments/${id}`, { status: values.status });
        toast('Status updated.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAppointment(id) {
      const ok = await confirmAction('This appointment will be removed permanently.');
      if (!ok) return;
      try {
        await API.delete(`/appointments/${id}`);
        toast('Appointment deleted.');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  }
};
