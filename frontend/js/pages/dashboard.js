/* Dashboard -- a read-only summary, assembled from whatever this role can see. */

const DashboardPage = {
  title: 'Dashboard',
  subtitle: 'A snapshot of today across the hospital.',

  async render(view, user) {
    view.innerHTML = `
      <div class="stats" id="stats"></div>
      <section class="panel">
        <div class="panel-head">Today's appointments</div>
        <div class="table-scroll" id="todayList"><div class="empty">Loading...</div></div>
      </section>`;

    const today = todayISO();

    /*
     * Each tile comes from a different service. Promise.allSettled is used
     * instead of Promise.all on purpose: if one service is down, or this
     * role is not allowed to read it, the rest of the dashboard should
     * still render. One service failing must not blank the whole page.
     */
    const [patientsResult, doctorsResult, apptResult, billsResult] = await Promise.allSettled([
      API.get('/patients/'),
      API.get('/doctors/'),
      can(user, 'admin', 'doctor', 'receptionist') ? API.get(`/appointments/?date=${today}`) : Promise.resolve([]),
      can(user, 'admin', 'billing', 'receptionist') ? API.get('/billing/?status=unpaid') : Promise.resolve([])
    ]);

    const patients     = valueOf(patientsResult, []);
    const doctors      = valueOf(doctorsResult, []);
    const appointments = valueOf(apptResult, []);
    const unpaid       = valueOf(billsResult, []);

    const tiles = [
      { label: 'Patients registered', value: patients.length },
      { label: 'Doctors on staff',    value: doctors.length }
    ];

    if (can(user, 'admin', 'doctor', 'receptionist')) {
      tiles.push({
        label: 'Appointments today',
        value: appointments.length,
        note: `${appointments.filter((a) => a.status === 'scheduled').length} still to be seen`
      });
    }

    if (can(user, 'admin', 'billing', 'receptionist')) {
      const outstanding = unpaid.reduce((sum, b) => sum + (b.amount || 0), 0);
      tiles.push({ label: 'Outstanding', value: money(outstanding), note: `${unpaid.length} unpaid bills` });
    }

    document.getElementById('stats').innerHTML = tiles.map((t) => `
      <div class="stat">
        <div class="stat-label">${esc(t.label)}</div>
        <div class="stat-value">${esc(t.value)}</div>
        ${t.note ? `<div class="stat-note">${esc(t.note)}</div>` : ''}
      </div>`).join('');

    drawToday();

    function valueOf(result, fallback) {
      return result.status === 'fulfilled' && result.value ? result.value : fallback;
    }

    function drawToday() {
      const container = document.getElementById('todayList');

      if (!can(user, 'admin', 'doctor', 'receptionist')) {
        container.innerHTML = '<div class="empty">Your role does not have access to the schedule.</div>';
        return;
      }
      if (appointments.length === 0) {
        container.innerHTML = '<div class="empty">Nothing booked for today.</div>';
        return;
      }

      const STATUS_STYLE = { scheduled: 'pill-neutral', completed: 'pill-ok', cancelled: 'pill-danger' };
      const nameOf = (list, id) => {
        const found = list.find((x) => x._id === id);
        return found ? found.name : 'Unknown';
      };

      const sorted = [...appointments].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      container.innerHTML = `
        <table>
          <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            ${sorted.map((a) => `
              <tr>
                <td class="num">${esc(a.time || '--')}</td>
                <td><strong>${esc(nameOf(patients, a.patientId))}</strong></td>
                <td>${esc(nameOf(doctors, a.doctorId))}</td>
                <td>${esc(a.reason || '--')}</td>
                <td><span class="pill ${STATUS_STYLE[a.status] || 'pill-neutral'}">${esc(a.status)}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }
  }
};
