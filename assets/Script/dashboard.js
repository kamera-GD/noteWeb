document.addEventListener('DOMContentLoaded', function() {
    
    // 1. CHUYỂN ĐỔI GRID / LIST VIEW
    const notesContainer = document.getElementById('notes-container');
    const btnGrid = document.getElementById('btnGrid');
    const btnList = document.getElementById('btnList');

    btnList.addEventListener('click', () => {
        notesContainer.classList.add('list-view');
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
    });

    btnGrid.addEventListener('click', () => {
        notesContainer.classList.remove('list-view');
        btnGrid.classList.add('active');
        btnList.classList.remove('active');
    });

    // 2. MODAL THÊM/SỬA & XÓA GHI CHÚ
    const noteModal = new bootstrap.Modal(document.getElementById('noteModal')); 
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    
    const btnAddNote = document.getElementById('btnAddNote');
    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const noteId = document.getElementById('noteId');
    const saveStatus = document.getElementById('saveStatus');
    const btnSaveInModal = document.getElementById('btnSaveInModal');
    const btnDeleteInModal = document.getElementById('btnDeleteInModal');
    
    let noteCardToDelete = null; 
    let currentEditingCard = null; // Biến lưu trữ thẻ ghi chú đang được thao tác
    let currentNoteLabels = []; // Lưu nhãn của ghi chú hiện tại
    let selectedFilterLabel = null; // Lưu nhãn được chọn để lọc

    // Ẩn nút Lưu khi mới load trang
    btnSaveInModal.classList.add('d-none');

    // Bấm nút Tạo ghi chú mới
    btnAddNote.addEventListener('click', () => {
        noteId.value = ''; 
        noteTitle.value = ''; 
        noteContent.value = ''; 
        saveStatus.innerText = 'Chưa lưu. Nhấn nút Lưu để lưu ghi chú.'; 
        btnSaveInModal.classList.add('d-none'); // Ẩn nút lưu khi mới tạo form
        btnDeleteInModal.classList.add('d-none'); // Ẩn nút xóa khi mới mở form
        currentNoteLabels = []; // Xóa các nhãn cũ
        currentEditingCard = null; // Đặt lại trạng thái
        renderLabelsInModal([]); // Render labels rỗng
        noteModal.show();
    });

    // Hiện nút Lưu khi nhập ký tự
    const showSaveButton = () => {
        if (noteTitle.value.trim() !== '' || noteContent.value.trim() !== '') {
            btnSaveInModal.classList.remove('d-none');
        }
    };

    noteTitle.addEventListener('input', showSaveButton);
    noteContent.addEventListener('input', showSaveButton);

    // Hàm render labels trong modal
    const renderLabelsInModal = (labels = []) => {
        const labelsContainer = document.getElementById('noteLabelsContainer');
        labelsContainer.innerHTML = '';
        
        // Thêm các label đã chọn
        labels.forEach(label => {
            const labelHTML = `
                <span class="badge bg-secondary rounded-pill fw-normal me-1 cursor-pointer label-badge" data-label="${label}">
                    ${label} <i class="fa-solid fa-xmark ms-1 remove-label"></i>
                </span>
            `;
            labelsContainer.insertAdjacentHTML('beforeend', labelHTML);
        });
        
        // Thêm nút "Thêm nhãn"
        const addLabelHTML = `
            <span class="badge bg-light text-dark border rounded-pill fw-normal cursor-pointer" id="btnAddLabelToNote" title="Thêm nhãn">
                <i class="fa-solid fa-plus"></i> Thêm nhãn
            </span>
        `;
        labelsContainer.insertAdjacentHTML('beforeend', addLabelHTML);
        
        // Sự kiện xóa label
        document.querySelectorAll('.remove-label').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const badge = icon.closest('.label-badge');
                badge.remove();
            });
        });
        
        // Sự kiện thêm label
        document.getElementById('btnAddLabelToNote').addEventListener('click', showLabelDropdown);
    };

    // Hiện dropdown để thêm nhãn
    const showLabelDropdown = () => {
        // Lấy tất cả các nhãn từ sidebar
        const allLabels = Array.from(document.querySelectorAll('#sidebarLabelList .nav-link')).map(link => 
            link.textContent.trim()
        );
        
        // Lấy các nhãn đã chọn
        const selectedLabels = Array.from(document.querySelectorAll('.label-badge')).map(badge => 
            badge.dataset.label
        );
        
        // Tạo dropdown
        let dropdownHTML = '<div id="labelDropdown" style="position:absolute; background:white; border:1px solid #ddd; border-radius:4px; padding:5px; z-index:1000; box-shadow:0 2px 8px rgba(0,0,0,0.1)">';
        
        allLabels.forEach(label => {
            const isSelected = selectedLabels.includes(label);
            dropdownHTML += `
                <div class="p-2 cursor-pointer" style="padding:5px 10px; ${isSelected ? 'background:#e9ecef;' : ''}">
                    <i class="fa-solid fa-tag me-2"></i>${label}
                </div>
            `;
        });
        
        dropdownHTML += '</div>';
        
        const container = document.getElementById('noteLabelsContainer');
        container.insertAdjacentHTML('beforeend', dropdownHTML);
        
        // Sự kiện click trên các label trong dropdown
        document.querySelectorAll('#labelDropdown > div').forEach((item, idx) => {
            item.addEventListener('click', () => {
                const label = allLabels[idx];
                const isBadgeExists = document.querySelector(`[data-label="${label}"]`);
                
                if (!isBadgeExists) {
                    const labelHTML = `
                        <span class="badge bg-secondary rounded-pill fw-normal me-1 cursor-pointer label-badge" data-label="${label}">
                            ${label} <i class="fa-solid fa-xmark ms-1 remove-label"></i>
                        </span>
                    `;
                    container.insertAdjacentHTML('beforeend', labelHTML);
                    
                    // Thêm sự kiện xóa cho badge mới
                    document.querySelectorAll('.remove-label').forEach(icon => {
                        icon.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const badge = icon.closest('.label-badge');
                            badge.remove();
                        });
                    });
                }
                
                document.getElementById('labelDropdown').remove();
            });
        });
        
        // Đóng dropdown khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#noteLabelsContainer') && !e.target.closest('#labelDropdown')) {
                const dropdown = document.getElementById('labelDropdown');
                if (dropdown) dropdown.remove();
            }
        }, { once: true });
    };

    // Hàm gán sự kiện click cho các thẻ ghi chú (để Sửa hoặc Xóa)
    function attachNoteEvents() {
        const noteCards = document.querySelectorAll('.note-card');
        noteCards.forEach((card, index) => {
            card.onclick = null; // Xóa sự kiện cũ để tránh lặp
            card.onclick = (e) => {
                if(e.target.classList.contains('btn-delete')) {
                    e.stopPropagation(); 
                    noteCardToDelete = card.closest('.note-item'); 
                    deleteConfirmModal.show(); 
                    return;
                }
                const title = card.querySelector('.note-title').innerText;
                const content = card.querySelector('.note-content').innerText;
                const noteItem = card.closest('.note-item');
                const labels = noteItem.dataset.labels ? noteItem.dataset.labels.split(',') : [];
                
                noteId.value = noteItem.dataset.id || index + 1; 
                noteTitle.value = title;
                noteContent.value = content;
                currentNoteLabels = labels; // Lưu labels hiện tại
                renderLabelsInModal(labels); // Render labels
                saveStatus.innerText = 'Đang chỉnh sửa. Nhấn Lưu để cập nhật.';
                saveStatus.className = 'text-muted small mt-3 text-end';
                btnSaveInModal.classList.remove('d-none');
                btnDeleteInModal.classList.remove('d-none');
                
                currentEditingCard = noteItem; // Lưu lại thẻ đang sửa
                noteModal.show();
            };
        });
    }
    attachNoteEvents(); // Gọi lần đầu khi load trang

    // Xóa ghi chú từ bên trong Modal
    btnDeleteInModal.addEventListener('click', () => {
        noteModal.hide(); 
        noteCardToDelete = currentEditingCard;
        deleteConfirmModal.show(); 
    });

    // Xác nhận Xóa
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (noteCardToDelete) {
            noteCardToDelete.style.transition = "opacity 0.3s ease";
            noteCardToDelete.style.opacity = "0";
            setTimeout(() => {
                noteCardToDelete.remove(); 
                deleteConfirmModal.hide(); 
                noteCardToDelete = null;
            }, 300);
        }
    });

    // Hàm lưu khi người dùng bấm nút Lưu
    const saveNote = () => {
        const titleVal = noteTitle.value.trim() || 'Ghi chú không tên';
        const contentVal = noteContent.value.trim();
        const currentId = noteId.value;
        
        // Lấy các nhãn được chọn từ modal
        const labelBadges = document.querySelectorAll('#noteLabelsContainer .label-badge');
        const labelsArray = Array.from(labelBadges).map(badge => badge.dataset.label);

        if (!currentId) {
            // Ghi chú mới -> thêm thẻ
            const fakeId = 'note_' + Math.floor(Math.random() * 1000);
            noteId.value = fakeId;
            btnDeleteInModal.classList.remove('d-none');
            
            // Tạo HTML cho nhãn
            let labelsHTML = '';
            if (labelsArray.length > 0) {
                labelsHTML = '<div class="note-labels">' + 
                    labelsArray.map(label => `<span class="badge bg-secondary rounded-pill fw-normal">${label}</span>`).join('') +
                    '</div>';
            }

            const newCardHTML = `
                <div class="col-md-4 col-sm-6 note-item" data-id="${fakeId}" data-labels="${labelsArray.join(',')}">
                    <div class="note-card">
                        <div class="status-icons">
                            <i class="fa-solid fa-trash-can text-danger btn-delete" title="Xóa"></i>
                        </div>
                        <div class="note-title">${titleVal}</div>
                        <div class="note-content mb-3">${contentVal}</div>
                        ${labelsHTML}
                    </div>
                </div>
            `;
            notesContainer.insertAdjacentHTML('afterbegin', newCardHTML);
            currentEditingCard = notesContainer.firstElementChild;
            attachNoteEvents();
        } else {
            // Cập nhật ghi chú cũ
            if (currentEditingCard) {
                currentEditingCard.querySelector('.note-title').innerText = titleVal;
                currentEditingCard.querySelector('.note-content').innerText = contentVal;
                
                // Cập nhật nhãn
                currentEditingCard.dataset.labels = labelsArray.join(',');
                let labelsContainer = currentEditingCard.querySelector('.note-labels');
                if (labelsArray.length > 0) {
                    if (!labelsContainer) {
                        labelsContainer = document.createElement('div');
                        labelsContainer.className = 'note-labels';
                        currentEditingCard.querySelector('.note-card').appendChild(labelsContainer);
                    }
                    labelsContainer.innerHTML = labelsArray.map(label => 
                        `<span class="badge bg-secondary rounded-pill fw-normal">${label}</span>`
                    ).join('');
                } else if (labelsContainer) {
                    labelsContainer.remove();
                }
            }
        }

        const time = new Date().toLocaleTimeString();
        saveStatus.innerText = `Đã lưu lúc ${time}`;
        saveStatus.className = 'text-success fw-bold small mt-3 text-end';
        btnSaveInModal.classList.add('d-none'); // Ẩn nút lưu
        
        // Hiện nút Lưu lại sau 1 giây để cho phép lưu tiếp
        setTimeout(() => {
            btnSaveInModal.classList.remove('d-none');
        }, 1000);
    };

    btnSaveInModal.addEventListener('click', saveNote);

    // ==========================================
    // 3. QUẢN LÝ NHÃN (LABEL MANAGEMENT)
    // ==========================================
    const labelManageModal = new bootstrap.Modal(document.getElementById('labelManageModal'));
    const btnOpenManageLabels = document.getElementById('btnOpenManageLabels');
    const btnCreateLabel = document.getElementById('btnCreateLabel');
    const btnDeleteLabel = document.getElementById('btnDeleteLabel');
    const newLabelInput = document.getElementById('newLabelInput');
    const editLabelList = document.getElementById('editLabelList');
    const sidebarLabelList = document.getElementById('sidebarLabelList'); // Thêm dòng này để gọi Sidebar

    btnOpenManageLabels.addEventListener('click', (e) => {
        e.preventDefault();
        labelManageModal.show();
    });

    btnCreateLabel.addEventListener('click', () => {
        const labelName = newLabelInput.value.trim();
        if (labelName !== '') {
            // 1. Thêm nhãn vào danh sách trong Modal
            const newLabelHTML = `
                <div class="d-flex align-items-center justify-content-between p-2 hover-bg-light rounded label-edit-item">
                    <i class="fa-solid fa-tag text-muted me-2"></i>
                    <input type="text" class="form-control form-control-sm border-0 shadow-none p-0 bg-transparent label-name-input" value="${labelName}">
                    <i class="fa-solid fa-trash-can text-danger ms-2 cursor-pointer" title="Xóa nhãn này"></i>
                </div>
            `;
            editLabelList.insertAdjacentHTML('beforeend', newLabelHTML);

            // 2. SỬA LỖI: Thêm nhãn vừa tạo ra ngoài Sidebar bên trái
            const newSidebarItemHTML = `
                <li class="nav-item">
                    <a class="nav-link text-dark" href="#">
                        <i class="fa-solid fa-tag me-2 text-secondary"></i> ${labelName}
                    </a>
                </li>
            `;
            sidebarLabelList.insertAdjacentHTML('beforeend', newSidebarItemHTML);

            newLabelInput.value = ''; // Xóa trắng ô nhập
        }
    });

    // ==========================================
    // 4. LỌC GHI CHÚ THEO NHÃN
    // ==========================================
    // Hàm lọc ghi chú theo nhãn
    const filterNotesByLabel = (labelName) => {
        const noteItems = document.querySelectorAll('.note-item');
        noteItems.forEach(item => {
            const labels = item.dataset.labels ? item.dataset.labels.split(',') : [];
            if (labelName === null) {
                // Hiện tất cả
                item.style.display = '';
            } else if (labels.includes(labelName)) {
                // Hiện nếu có nhãn được chọn
                item.style.display = '';
            } else {
                // Ẩn nếu không có nhãn được chọn
                item.style.display = 'none';
            }
        });
    };

    // Sự kiện click trên các nhãn trong sidebar
    const attachLabelFilterEvents = () => {
        const sidebarLabels = sidebarLabelList.querySelectorAll('.nav-link');
        sidebarLabels.forEach(labelLink => {
            labelLink.addEventListener('click', (e) => {
                e.preventDefault();
                const labelName = labelLink.textContent.trim();
                
                // Cập nhật active class
                document.querySelectorAll('.sidebar-container .nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                labelLink.classList.add('active');
                
                selectedFilterLabel = labelName;
                filterNotesByLabel(labelName);
            });
        });
    };
    attachLabelFilterEvents();

    // Sự kiện cho "Tất cả Ghi chú" để xóa bộ lọc
    const allNotesLink = document.querySelector('.sidebar-container .nav-link:first-child');
    if (allNotesLink) {
        allNotesLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Cập nhật active class
            document.querySelectorAll('.sidebar-container .nav-link').forEach(link => {
                link.classList.remove('active');
            });
            allNotesLink.classList.add('active');
            
            selectedFilterLabel = null;
            filterNotesByLabel(null);
        });
    }

    // Gọi lại attachLabelFilterEvents khi tạo nhãn mới
    const originalCreateLabel = btnCreateLabel.onclick;
    btnCreateLabel.addEventListener('click', () => {
        setTimeout(() => {
            attachLabelFilterEvents();
        }, 100);
    });
});