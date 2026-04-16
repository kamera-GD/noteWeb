document.addEventListener('DOMContentLoaded', function () {
    const notesContainer = document.getElementById('notes-container');
    const emptyNotesMessage = document.getElementById('emptyNotesMessage');
    const btnGrid = document.getElementById('btnGrid');
    const btnList = document.getElementById('btnList');
    const searchInput = document.getElementById('searchInput');
    const btnAddNote = document.getElementById('btnAddNote');
    const btnLogout = document.getElementById('btnLogout');
    const currentUserName = document.getElementById('currentUserName');
    const allNotesLink = document.getElementById('allNotesLink');
    const sidebarLabelList = document.getElementById('sidebarLabelList');
    const noteLabelsContainer = document.getElementById('noteLabelsContainer');
    const btnOpenManageLabels = document.getElementById('btnOpenManageLabels');
    const btnCreateLabel = document.getElementById('btnCreateLabel');
    const newLabelInput = document.getElementById('newLabelInput');
    const editLabelList = document.getElementById('editLabelList');

    const noteModal = new bootstrap.Modal(document.getElementById('noteModal'));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const labelManageModal = new bootstrap.Modal(document.getElementById('labelManageModal'));
    const verifyNotePasswordModal = new bootstrap.Modal(document.getElementById('verifyNotePasswordModal'));
    const manageNotePasswordModal = new bootstrap.Modal(document.getElementById('manageNotePasswordModal'));

    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const noteId = document.getElementById('noteId');
    const saveStatus = document.getElementById('saveStatus');
    const btnDeleteInModal = document.getElementById('btnDeleteInModal');
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const verifyNotePasswordForm = document.getElementById('verifyNotePasswordForm');
    const verifyNotePasswordInput = document.getElementById('verifyNotePasswordInput');
    const verifyNotePasswordError = document.getElementById('verifyNotePasswordError');
    const manageNotePasswordForm = document.getElementById('manageNotePasswordForm');
    const passwordActionSelect = document.getElementById('passwordActionSelect');
    const passwordCurrentWrap = document.getElementById('passwordCurrentWrap');
    const passwordNewWrap = document.getElementById('passwordNewWrap');
    const passwordConfirmWrap = document.getElementById('passwordConfirmWrap');
    const passwordCurrentInput = document.getElementById('passwordCurrentInput');
    const passwordNewInput = document.getElementById('passwordNewInput');
    const passwordConfirmInput = document.getElementById('passwordConfirmInput');
    const manageNotePasswordError = document.getElementById('manageNotePasswordError');

    let notes = [];
    let labels = [];
    let selectedFilterLabel = '';
    let currentNoteLabels = [];
    let currentNoteIsLocked = false;
    let currentNotePassword = '';
    let noteIdToDelete = 0;
    let verifyTargetAction = '';
    let verifyTargetNoteId = 0;
    let autoSaveTimer = null;
    let searchTimer = null;
    let isSaving = false;

    const callNotesApi = async (formData = null) => {
        const options = formData ? { method: 'POST', body: formData } : { method: 'GET' };
        const response = await fetch('../api/notes.php', options);
        const result = await response.json();
        if (!result.success && response.status === 401) {
            window.location.href = '../index.html';
            throw new Error('unauthorized');
        }
        return result;
    };

    const escapeHtml = (text) => String(text || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const setVerifyError = (message) => {
        verifyNotePasswordError.textContent = message || '';
        verifyNotePasswordError.classList.toggle('d-none', !message);
    };

    const setManagePasswordError = (message) => {
        manageNotePasswordError.textContent = message || '';
        manageNotePasswordError.classList.toggle('d-none', !message);
    };

    const updatePasswordActionUI = () => {
        const action = passwordActionSelect.value;
        passwordCurrentWrap.classList.toggle('d-none', !(action === 'change' || action === 'disable'));
        passwordNewWrap.classList.toggle('d-none', !(action === 'set' || action === 'change'));
        passwordConfirmWrap.classList.toggle('d-none', !(action === 'set' || action === 'change'));
    };

    const renderNotes = (list) => {
        notesContainer.innerHTML = '';
        if (list.length === 0) {
            emptyNotesMessage.classList.remove('d-none');
            return;
        }
        emptyNotesMessage.classList.add('d-none');
        notesContainer.innerHTML = list.map((note) => `
            <div class="col-md-4 col-sm-6 note-item" data-id="${note.id}">
                <div class="note-card">
                    <div class="status-icons">
                        ${Number(note.is_locked) === 1 ? '<i class="fa-solid fa-lock text-warning me-1" title="Ghi chú có mật khẩu"></i>' : ''}
                        <i class="fa-solid fa-thumbtack ${Number(note.is_pinned) === 1 ? 'text-warning' : 'text-secondary'} btn-pin me-1" data-id="${note.id}" data-pinned="${Number(note.is_pinned) === 1 ? '1' : '0'}" title="${Number(note.is_pinned) === 1 ? 'Bỏ ghim' : 'Ghim lên đầu'}"></i>
                        <i class="fa-solid fa-trash-can text-danger btn-delete" data-id="${note.id}" title="Xóa"></i>
                    </div>
                    <div class="note-title">${escapeHtml(note.title || 'Ghi chú không tên')}</div>
                    <div class="note-content mb-3">${escapeHtml(note.content || '')}</div>
                    ${note.labels && note.labels.length > 0 ? `<div class="note-labels">${note.labels.map((name) => `<span class="badge bg-secondary rounded-pill fw-normal">${escapeHtml(name)}</span>`).join('')}</div>` : ''}
                </div>
            </div>
        `).join('');
    };

    const applySearch = (keyword) => {
        const q = keyword.trim().toLowerCase();
        const filtered = notes.filter((note) => {
            const title = (note.title || '').toLowerCase();
            const content = (note.content || '').toLowerCase();
            const inKeyword = !q || title.includes(q) || content.includes(q);
            const inLabel = !selectedFilterLabel || (note.labels || []).includes(selectedFilterLabel);
            return inKeyword && inLabel;
        });
        renderNotes(filtered);
    };

    const renderSidebarLabels = () => {
        if (labels.length === 0) {
            sidebarLabelList.innerHTML = '<div class="text-muted small px-3">Chưa có nhãn</div>';
            return;
        }
        sidebarLabelList.innerHTML = labels.map((label) => `
            <li class="nav-item">
                <a class="nav-link text-dark label-filter-link ${selectedFilterLabel === label.name ? 'active' : ''}" href="#" data-label="${escapeHtml(label.name)}">
                    <i class="fa-solid fa-tag me-2 text-secondary"></i> ${escapeHtml(label.name)}
                </a>
            </li>
        `).join('');
    };

    const renderLabelBadgesInModal = () => {
        const tags = currentNoteLabels.map((name) => `<span class="badge bg-secondary rounded-pill fw-normal me-1 cursor-pointer selected-note-label" data-label="${escapeHtml(name)}">${escapeHtml(name)} <i class="fa-solid fa-xmark ms-1"></i></span>`).join('');
        const selectHtml = labels.length === 0
            ? '<div class="text-muted small">Chưa có nhãn, hãy tạo trong "Chỉnh sửa nhãn".</div>'
            : `<select class="form-select form-select-sm d-inline-block mt-2" id="noteLabelSelect" style="max-width:220px;"><option value="">+ Gắn nhãn cho ghi chú</option>${labels.map((label) => `<option value="${escapeHtml(label.name)}">${escapeHtml(label.name)}</option>`).join('')}</select>`;
        noteLabelsContainer.innerHTML = tags + selectHtml;
    };

    const renderManageLabels = () => {
        if (labels.length === 0) {
            editLabelList.innerHTML = '<div class="text-muted small p-2">Chưa có nhãn</div>';
            return;
        }
        editLabelList.innerHTML = labels.map((label) => `
            <div class="d-flex align-items-center justify-content-between p-2 hover-bg-light rounded label-edit-item" data-id="${label.id}">
                <i class="fa-solid fa-tag text-muted me-2"></i>
                <input type="text" class="form-control form-control-sm border-0 shadow-none p-0 bg-transparent label-name-input" value="${escapeHtml(label.name)}">
                <i class="fa-solid fa-trash-can text-danger ms-2 cursor-pointer btn-delete-label" title="Xóa nhãn này"></i>
            </div>
        `).join('');
    };

    const openNoteEditor = (note, password = '') => {
        noteId.value = String(note.id);
        currentNoteIsLocked = Number(note.is_locked) === 1;
        currentNotePassword = password;
        noteTitle.value = note.title || '';
        noteContent.value = note.content || '';
        currentNoteLabels = Array.isArray(note.labels) ? [...note.labels] : [];
        renderLabelBadgesInModal();
        saveStatus.textContent = 'Đang chỉnh sửa, hệ thống sẽ tự lưu';
        saveStatus.className = 'text-muted small mt-2 text-end';
        btnDeleteInModal.classList.remove('d-none');
        noteModal.show();
    };

    const loadNotes = async () => {
        try {
            const result = await callNotesApi();
            notes = result.data.notes || [];
            labels = result.data.labels || [];
            currentUserName.textContent = result.data.display_name || 'User';
            renderSidebarLabels();
            renderManageLabels();
            applySearch(searchInput.value);
        } catch (error) {
            if (error.message !== 'unauthorized') {
                saveStatus.textContent = 'Không thể tải dữ liệu ghi chú';
                saveStatus.className = 'text-danger small mt-2 text-end';
            }
        }
    };

    const saveCurrentNote = async () => {
        if (isSaving) return;
        const title = noteTitle.value.trim();
        const content = noteContent.value.trim();
        const currentId = noteId.value;
        if (title === '' && content === '') {
            saveStatus.textContent = 'Ghi chú trống nên chưa lưu';
            saveStatus.className = 'text-muted small mt-2 text-end';
            return;
        }

        isSaving = true;
        saveStatus.textContent = 'Đang tự lưu...';
        saveStatus.className = 'text-muted small mt-2 text-end';

        const formData = new FormData();
        formData.append('action', 'save');
        formData.append('note_id', currentId);
        formData.append('title', title);
        formData.append('content', content);
        formData.append('labels', JSON.stringify(currentNoteLabels));
        if (currentId && currentNoteIsLocked) {
            formData.append('note_password', currentNotePassword);
        }

        const result = await callNotesApi(formData);
        if (!result.success) {
            saveStatus.textContent = result.message || 'Lưu thất bại';
            saveStatus.className = 'text-danger small mt-2 text-end';
            isSaving = false;
            return;
        }
        if (!currentId && result.data && result.data.note_id) {
            noteId.value = String(result.data.note_id);
            btnDeleteInModal.classList.remove('d-none');
        }
        saveStatus.textContent = `Đã tự lưu lúc ${new Date().toLocaleTimeString()}`;
        saveStatus.className = 'text-success small mt-2 text-end';
        await loadNotes();
        isSaving = false;
    };

    const scheduleAutoSave = () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            saveCurrentNote().catch(() => {
                saveStatus.textContent = 'Không thể kết nối máy chủ';
                saveStatus.className = 'text-danger small mt-2 text-end';
            });
        }, 700);
    };

    btnAddNote.addEventListener('click', () => {
        noteId.value = '';
        noteTitle.value = '';
        noteContent.value = '';
        currentNoteLabels = [];
        currentNoteIsLocked = false;
        currentNotePassword = '';
        renderLabelBadgesInModal();
        saveStatus.textContent = 'Nhập tiêu đề hoặc nội dung để tự lưu';
        saveStatus.className = 'text-muted small mt-2 text-end';
        btnDeleteInModal.classList.add('d-none');
        noteModal.show();
    });

    notesContainer.addEventListener('click', async (event) => {
        const pinBtn = event.target.closest('.btn-pin');
        if (pinBtn) {
            event.stopPropagation();
            const targetId = Number(pinBtn.dataset.id || 0);
            if (!targetId) return;
            const formData = new FormData();
            formData.append('action', 'toggle_pin');
            formData.append('note_id', String(targetId));
            formData.append('pinned', pinBtn.dataset.pinned === '1' ? '0' : '1');
            await callNotesApi(formData);
            await loadNotes();
            return;
        }

        const deleteBtn = event.target.closest('.btn-delete');
        if (deleteBtn) {
            event.stopPropagation();
            noteIdToDelete = Number(deleteBtn.dataset.id || 0);
            const note = notes.find((item) => Number(item.id) === noteIdToDelete);
            if (note && Number(note.is_locked) === 1) {
                verifyTargetAction = 'delete';
                verifyTargetNoteId = noteIdToDelete;
                verifyNotePasswordInput.value = '';
                setVerifyError('');
                verifyNotePasswordModal.show();
                return;
            }
            currentNotePassword = '';
            deleteConfirmModal.show();
            return;
        }

        const card = event.target.closest('.note-item');
        if (!card) return;
        const selectedId = Number(card.dataset.id || 0);
        const selectedNote = notes.find((item) => Number(item.id) === selectedId);
        if (!selectedNote) return;
        if (Number(selectedNote.is_locked) === 1) {
            verifyTargetAction = 'open';
            verifyTargetNoteId = selectedId;
            verifyNotePasswordInput.value = '';
            setVerifyError('');
            verifyNotePasswordModal.show();
            return;
        }
        openNoteEditor(selectedNote);
    });

    verifyNotePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = verifyNotePasswordInput.value.trim();
        if (!password) {
            setVerifyError('Vui lòng nhập mật khẩu');
            return;
        }
        const formData = new FormData();
        formData.append('action', 'verify_note_password');
        formData.append('note_id', String(verifyTargetNoteId));
        formData.append('password', password);
        const result = await callNotesApi(formData);
        if (!result.success) {
            setVerifyError(result.message || 'Mật khẩu không đúng');
            return;
        }
        verifyNotePasswordModal.hide();
        if (verifyTargetAction === 'open') {
            const note = notes.find((item) => Number(item.id) === verifyTargetNoteId);
            if (note) openNoteEditor(note, password);
        } else if (verifyTargetAction === 'delete') {
            currentNotePassword = password;
            noteIdToDelete = verifyTargetNoteId;
            deleteConfirmModal.show();
        }
        verifyTargetAction = '';
        verifyTargetNoteId = 0;
    });

    document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
        if (!noteIdToDelete) return;
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('note_id', String(noteIdToDelete));
        if (currentNotePassword) formData.append('note_password', currentNotePassword);
        const result = await callNotesApi(formData);
        if (!result.success) return;
        deleteConfirmModal.hide();
        if (Number(noteId.value) === noteIdToDelete) noteModal.hide();
        noteIdToDelete = 0;
        currentNotePassword = '';
        await loadNotes();
    });

    btnDeleteInModal.addEventListener('click', () => {
        noteIdToDelete = Number(noteId.value || 0);
        if (!noteIdToDelete) return;
        deleteConfirmModal.show();
    });

    btnTogglePassword.addEventListener('click', () => {
        const currentId = Number(noteId.value || 0);
        if (!currentId) {
            setManagePasswordError('Hãy lưu ghi chú trước khi đặt mật khẩu');
            manageNotePasswordModal.show();
            return;
        }
        setManagePasswordError('');
        passwordCurrentInput.value = '';
        passwordNewInput.value = '';
        passwordConfirmInput.value = '';
        passwordActionSelect.value = currentNoteIsLocked ? 'change' : 'set';
        updatePasswordActionUI();
        manageNotePasswordModal.show();
    });

    passwordActionSelect.addEventListener('change', () => {
        setManagePasswordError('');
        updatePasswordActionUI();
    });

    manageNotePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentId = Number(noteId.value || 0);
        if (!currentId) {
            setManagePasswordError('Ghi chú chưa được lưu');
            return;
        }
        const action = passwordActionSelect.value;
        const formData = new FormData();

        if (action === 'set' || action === 'change') {
            const newPassword = passwordNewInput.value.trim();
            const confirmPassword = passwordConfirmInput.value.trim();
            if (!newPassword || !confirmPassword) {
                setManagePasswordError('Vui lòng nhập đủ mật khẩu mới');
                return;
            }
            formData.append('action', 'set_note_password');
            formData.append('note_id', String(currentId));
            formData.append('new_password', newPassword);
            formData.append('confirm_password', confirmPassword);
            if (action === 'change') {
                const currentPassword = passwordCurrentInput.value.trim();
                if (!currentPassword) {
                    setManagePasswordError('Vui lòng nhập mật khẩu hiện tại');
                    return;
                }
                formData.append('current_password', currentPassword);
            }
            const result = await callNotesApi(formData);
            if (!result.success) {
                setManagePasswordError(result.message || 'Không thể cập nhật mật khẩu');
                return;
            }
            currentNoteIsLocked = true;
            currentNotePassword = newPassword;
        } else {
            const currentPassword = passwordCurrentInput.value.trim();
            if (!currentPassword) {
                setManagePasswordError('Vui lòng nhập mật khẩu hiện tại');
                return;
            }
            formData.append('action', 'disable_note_password');
            formData.append('note_id', String(currentId));
            formData.append('current_password', currentPassword);
            const result = await callNotesApi(formData);
            if (!result.success) {
                setManagePasswordError(result.message || 'Không thể tắt mật khẩu');
                return;
            }
            currentNoteIsLocked = false;
            currentNotePassword = '';
        }

        manageNotePasswordModal.hide();
        await loadNotes();
    });

    noteTitle.addEventListener('input', scheduleAutoSave);
    noteContent.addEventListener('input', scheduleAutoSave);

    noteLabelsContainer.addEventListener('change', (event) => {
        if (event.target.id !== 'noteLabelSelect') return;
        const labelName = event.target.value.trim();
        if (!labelName || currentNoteLabels.includes(labelName)) return;
        currentNoteLabels.push(labelName);
        renderLabelBadgesInModal();
        scheduleAutoSave();
    });

    noteLabelsContainer.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.selected-note-label');
        if (!removeBtn) return;
        const labelName = removeBtn.dataset.label || '';
        currentNoteLabels = currentNoteLabels.filter((name) => name !== labelName);
        renderLabelBadgesInModal();
        scheduleAutoSave();
    });

    searchInput.closest('form').addEventListener('submit', (e) => e.preventDefault());
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => applySearch(searchInput.value), 300);
    });

    btnGrid.addEventListener('click', () => {
        notesContainer.classList.remove('list-view');
        btnGrid.classList.add('active');
        btnList.classList.remove('active');
    });

    btnList.addEventListener('click', () => {
        notesContainer.classList.add('list-view');
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
    });

    btnLogout.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('action', 'logout');
        await callNotesApi(formData);
        window.location.href = '../index.html';
    });

    allNotesLink.addEventListener('click', (e) => {
        e.preventDefault();
        selectedFilterLabel = '';
        document.querySelectorAll('.sidebar-container .nav-link').forEach((el) => el.classList.remove('active'));
        allNotesLink.classList.add('active');
        applySearch(searchInput.value);
        renderSidebarLabels();
    });

    sidebarLabelList.addEventListener('click', (event) => {
        const link = event.target.closest('.label-filter-link');
        if (!link) return;
        event.preventDefault();
        selectedFilterLabel = link.dataset.label || '';
        document.querySelectorAll('.sidebar-container .nav-link').forEach((el) => el.classList.remove('active'));
        link.classList.add('active');
        applySearch(searchInput.value);
        renderSidebarLabels();
    });

    btnOpenManageLabels.addEventListener('click', (e) => {
        e.preventDefault();
        renderManageLabels();
        labelManageModal.show();
    });

    btnCreateLabel.addEventListener('click', async () => {
        const name = newLabelInput.value.trim();
        if (!name) return;
        const formData = new FormData();
        formData.append('action', 'create_label');
        formData.append('name', name);
        const result = await callNotesApi(formData);
        if (!result.success) return;
        newLabelInput.value = '';
        await loadNotes();
    });

    editLabelList.addEventListener('change', async (event) => {
        const input = event.target.closest('.label-name-input');
        if (!input) return;
        const row = input.closest('.label-edit-item');
        const labelId = Number(row.dataset.id || 0);
        const newName = input.value.trim();
        if (!labelId || !newName) return;
        const formData = new FormData();
        formData.append('action', 'rename_label');
        formData.append('label_id', String(labelId));
        formData.append('name', newName);
        await callNotesApi(formData);
        await loadNotes();
    });

    editLabelList.addEventListener('click', async (event) => {
        const deleteBtn = event.target.closest('.btn-delete-label');
        if (!deleteBtn) return;
        const row = deleteBtn.closest('.label-edit-item');
        const labelId = Number(row.dataset.id || 0);
        if (!labelId) return;
        const formData = new FormData();
        formData.append('action', 'delete_label');
        formData.append('label_id', String(labelId));
        await callNotesApi(formData);
        await loadNotes();
        currentNoteLabels = currentNoteLabels.filter((name) => labels.some((item) => item.name === name));
        renderLabelBadgesInModal();
    });

    updatePasswordActionUI();
    loadNotes();
});