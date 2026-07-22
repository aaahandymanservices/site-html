(function () {
  const statuses = ['Scheduled', 'On The Way', 'In Progress', 'Completed'];
  const state = { jobs: [], query: '', status: 'all' };
  const elements = {
    body: document.getElementById('jobs-body'),
    table: document.getElementById('table-wrap'),
    loading: document.getElementById('loading-state'),
    empty: document.getElementById('empty-state'),
    emptyCopy: document.getElementById('empty-copy'),
    error: document.getElementById('error-state'),
    errorCopy: document.getElementById('error-copy'),
    modal: document.getElementById('job-modal'),
    form: document.getElementById('job-form'),
    formError: document.getElementById('form-error'),
    saveButton: document.getElementById('save-button'),
    userEmail: document.getElementById('user-email'),
    toastRegion: document.getElementById('toast-region'),
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (response.status === 401 || response.status === 403) {
      window.location.replace('/admin/login');
      throw new Error('Your admin session has expired.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  };

  const toast = (message, type = 'success') => {
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    elements.toastRegion.appendChild(item);
    window.setTimeout(() => item.remove(), 4600);
  };

  const formatDate = (value) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));

  const toLocalInput = (value) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const filteredJobs = () => state.jobs.filter((job) => {
    const matchesStatus = state.status === 'all' || job.status === state.status;
    const haystack = `${job.customerName} ${job.phone} ${job.email} ${job.jobAddress}`.toLowerCase();
    return matchesStatus && haystack.includes(state.query.toLowerCase());
  });

  const updateMetrics = () => {
    document.getElementById('metric-total').textContent = state.jobs.length;
    document.getElementById('metric-scheduled').textContent = state.jobs.filter((job) => job.status === 'Scheduled').length;
    document.getElementById('metric-active').textContent = state.jobs.filter((job) => ['On The Way', 'In Progress'].includes(job.status)).length;
    document.getElementById('metric-completed').textContent = state.jobs.filter((job) => job.status === 'Completed').length;
  };

  const render = () => {
    const jobs = filteredJobs();
    updateMetrics();
    elements.loading.hidden = true;
    elements.error.hidden = true;
    elements.table.hidden = jobs.length === 0;
    elements.empty.hidden = jobs.length !== 0;
    elements.emptyCopy.textContent = state.jobs.length
      ? 'No jobs match the current search and status filter.'
      : 'Add the first customer job to start managing the service schedule.';

    elements.body.innerHTML = jobs.map((job) => `
      <tr data-id="${job.id}">
        <td><span class="customer-name">${escapeHtml(job.customerName)}</span><span class="subtext">Job #${job.id}</span></td>
        <td><span>${escapeHtml(job.phone)}</span><span class="subtext">${escapeHtml(job.email)}</span></td>
        <td><div class="address">${escapeHtml(job.jobAddress)}</div></td>
        <td><span>${escapeHtml(formatDate(job.scheduledAt))}</span></td>
        <td>
          <select class="status-select" data-action="status" data-status="${escapeHtml(job.status)}" aria-label="Status for ${escapeHtml(job.customerName)}">
            ${statuses.map((status) => `<option${status === job.status ? ' selected' : ''}>${status}</option>`).join('')}
          </select>
        </td>
        <td><div class="row-actions">
          <button class="button button-alert" data-action="notify" type="button" ${job.status === 'Completed' ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            On the way
          </button>
          <button class="icon-button" data-action="edit" type="button" aria-label="Edit ${escapeHtml(job.customerName)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
          </button>
        </div></td>
      </tr>`).join('');
  };

  const loadJobs = async () => {
    elements.loading.hidden = false;
    elements.table.hidden = true;
    elements.empty.hidden = true;
    elements.error.hidden = true;
    try {
      const result = await request('/api/admin/jobs');
      state.jobs = result.jobs;
      render();
    } catch (error) {
      elements.loading.hidden = true;
      elements.error.hidden = false;
      elements.errorCopy.textContent = error.message;
    }
  };

  const openModal = (job) => {
    elements.form.reset();
    elements.formError.hidden = true;
    document.getElementById('modal-title').textContent = job ? 'Edit customer job' : 'Add customer job';
    document.getElementById('job-id').value = job?.id || '';
    document.getElementById('customer-name').value = job?.customerName || '';
    document.getElementById('phone').value = job?.phone || '';
    document.getElementById('email').value = job?.email || '';
    document.getElementById('job-address').value = job?.jobAddress || '';
    document.getElementById('scheduled-at').value = job ? toLocalInput(job.scheduledAt) : '';
    document.getElementById('job-status').value = job?.status || 'Scheduled';
    document.getElementById('notes').value = job?.notes || '';
    elements.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => document.getElementById('customer-name').focus(), 0);
  };

  const closeModal = () => {
    elements.modal.hidden = true;
    document.body.style.overflow = '';
  };

  const saveJob = async (event) => {
    event.preventDefault();
    elements.formError.hidden = true;
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = 'Saving…';
    const id = document.getElementById('job-id').value;
    const payload = {
      customerName: document.getElementById('customer-name').value,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value,
      jobAddress: document.getElementById('job-address').value,
      scheduledAt: new Date(document.getElementById('scheduled-at').value).toISOString(),
      status: document.getElementById('job-status').value,
      notes: document.getElementById('notes').value,
    };

    try {
      const result = await request(id ? `/api/admin/jobs/${id}` : '/api/admin/jobs', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const index = state.jobs.findIndex((job) => job.id === result.job.id);
      if (index >= 0) state.jobs[index] = result.job;
      else state.jobs.unshift(result.job);
      render();
      closeModal();
      toast(id ? 'Customer job updated.' : 'Customer job added.');
    } catch (error) {
      elements.formError.textContent = error.message;
      elements.formError.hidden = false;
    } finally {
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = 'Save customer job';
    }
  };

  const updateStatus = async (select, job) => {
    const previousStatus = job.status;
    select.disabled = true;
    try {
      const result = await request(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: select.value }),
      });
      Object.assign(job, result.job);
      render();
      toast(`${job.customerName} moved to ${job.status}.`);
    } catch (error) {
      select.value = previousStatus;
      toast(error.message, 'error');
    } finally {
      select.disabled = false;
    }
  };

  const notifyCustomer = async (button, job) => {
    if (!window.confirm(`Send an “On The Way” alert to ${job.customerName}?`)) return;
    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = 'Sending…';
    try {
      const result = await request(`/api/admin/jobs/${job.id}/notify`, { method: 'POST' });
      Object.assign(job, result.job);
      render();
      const channels = result.deliveries.filter((item) => item.status === 'sent').map((item) => item.channel.toUpperCase()).join(' + ');
      toast(`Alert sent to ${job.customerName} by ${channels}.`);
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
      button.innerHTML = original;
    }
  };

  elements.body.addEventListener('change', (event) => {
    const select = event.target.closest('[data-action="status"]');
    if (!select) return;
    const job = state.jobs.find((item) => item.id === Number(select.closest('tr').dataset.id));
    if (job) updateStatus(select, job);
  });

  elements.body.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const job = state.jobs.find((item) => item.id === Number(action.closest('tr').dataset.id));
    if (!job) return;
    if (action.dataset.action === 'edit') openModal(job);
    if (action.dataset.action === 'notify') notifyCustomer(action, job);
  });

  document.getElementById('search-input').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  document.getElementById('status-filter').addEventListener('change', (event) => { state.status = event.target.value; render(); });
  document.getElementById('add-job-button').addEventListener('click', () => openModal());
  document.getElementById('refresh-button').addEventListener('click', loadJobs);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-button').addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (event) => { if (event.target === elements.modal) closeModal(); });
  elements.form.addEventListener('submit', saveJob);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !elements.modal.hidden) closeModal(); });
  document.getElementById('logout-button').addEventListener('click', async () => {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
    window.location.replace('/admin/login');
  });

  request('/api/admin/session')
    .then((result) => { elements.userEmail.textContent = result.user.name || result.user.email || 'Administrator'; return loadJobs(); })
    .catch(() => {});
})();
