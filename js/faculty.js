const roomOrganization = {
            'block3': {
                name: 'Block 3',
                floors: {
                    '4': ['3405', '3406', '3407', '3408', '3409', '3410', '3411', '3412', '3413'],
                    '3': ['3311', '3312', '3313', '3310', '3309', '3308', '3305', '3304'],
                    '2': ['3203', '3202', '3404', '3402']
                }
            },
            'block1': {
                name: 'Block 1',
                floors: {
                    '4': ['1405', '1406', '1407'],
                    '3': ['1305', '1306', '1304', '1303', '1302', '1301'],
                    '2': ['1203', '1201'],
                    '1': []
                }
            }
        };

        const specialRoomConfigs = {
            '3404': {
                description: 'Rows 1-4: 8 seats each, Row 5: 4 seats',
                rowSeats: [8, 8, 8, 8, 4],
                totalSeats: 36,
                hasCustomRowConfig: true
            },
            '3402': {
                description: 'All rows: 8 seats each',
                rowSeats: [8, 8, 8, 8, 8],
                totalSeats: 40,
                hasCustomRowConfig: true
            },
            '3407': {
                description: 'All rows: 8 seats each',
                rowSeats: [8, 8, 8, 8, 8],
                totalSeats: 40,
                hasCustomRowConfig: true
            }
        };

        const DEFAULT_ROWS = 5;
        const DEFAULT_COLUMNS = 9;
        const FINE_PER_ABSENT = 100;

        const ROOM_MATRICES_KEY = 'roomMatrices';
        const DISABLED_ROOMS_KEY = 'disabledRooms';
        const FACULTY_WORKLOAD_KEY = 'facultyWorkload';
        const ROOM_ORGANIZATION_KEY = 'roomOrganization';

        let roomMatrices = JSON.parse(localStorage.getItem(ROOM_MATRICES_KEY) || '{}');
        let disabledRooms = JSON.parse(localStorage.getItem(DISABLED_ROOMS_KEY) || '[]');
        let currentSelectedRoomForMatrix = null;
        let isRowWiseConfig = false;

        const deptColors = {
            'CSE': '#ff6b6b', 'IT': '#4ecdc4', 'ECE': '#45b7d1', 'MECH': '#96c93d',
            'CIVIL': '#ff9f43', 'EEE': '#8338ec', 'CHEM': '#f4a261', 'AERO': '#2a9d8f',
            'BIO': '#e76f51', 'AI': '#7209b7'
        };

        const yearColors = {
            '1': '#ff69b4', '2': '#1e90ff', '3': '#ffff00', '4': '#800080'
        };

        let selectedArrangement = null;
        let selectedRoom = null;
        let selectedUnit = null;
        let currentRoomIndex = 0;
        let roomsForAttendance = [];
        let absentees = JSON.parse(localStorage.getItem('absentees') || '[]');
        let currentUnitFilter = 'all';
        let draggedRoom = null;
        let draggedRoomElement = null;

        function getAllAvailableRooms() {
            const allRooms = [];
            Object.values(roomOrganization).forEach(block => {
                Object.values(block.floors).forEach(floorRooms => {
                    floorRooms.forEach(room => {
                        if (!isRoomDisabled(room)) allRooms.push(room);
                    });
                });
            });
            return allRooms;
        }

        const facultyWorkload = {
            data: JSON.parse(localStorage.getItem(FACULTY_WORKLOAD_KEY) || '{}'),
            save() { localStorage.setItem(FACULTY_WORKLOAD_KEY, JSON.stringify(this.data)); },
            addAssignment(facultyName, examDate, unit) {
                if (!facultyName || !examDate || !unit) return false;
                const key = facultyName.trim().toLowerCase();
                if (!this.data[key]) this.data[key] = { name: facultyName.trim(), assignments: {} };
                if (!this.data[key].assignments[unit]) this.data[key].assignments[unit] = [];
                if (!this.data[key].assignments[unit].includes(examDate)) {
                    this.data[key].assignments[unit].push(examDate);
                    this.save();
                }
                return true;
            },
            canAssign(facultyName, unit) {
                const key = facultyName.trim().toLowerCase();
                if (!this.data[key] || !this.data[key].assignments[unit]) return true;
                return this.data[key].assignments[unit].length < 3;
            },
            getAssignmentCount(facultyName, unit) {
                const key = facultyName.trim().toLowerCase();
                return this.data[key] && this.data[key].assignments[unit] ? this.data[key].assignments[unit].length : 0;
            },
            getAllFaculty() { return Object.values(this.data); },
            reset() { this.data = {}; this.save(); }
        };

        function saveRoomOrganization() {
            localStorage.setItem(ROOM_ORGANIZATION_KEY, JSON.stringify(roomOrganization));
        }

        function initializeRoomMatrices() {
            const allRooms = [];
            Object.values(roomOrganization).forEach(block => {
                Object.values(block.floors).forEach(floorRooms => {
                    floorRooms.forEach(room => allRooms.push(room));
                });
            });
            allRooms.forEach(room => {
                if (!roomMatrices[room]) {
                    if (specialRoomConfigs[room]) {
                        const config = specialRoomConfigs[room];
                        roomMatrices[room] = {
                            rows: config.rowSeats.length,
                            columns: Math.max(...config.rowSeats),
                            totalSeats: config.totalSeats,
                            hasCustomRowConfig: config.hasCustomRowConfig,
                            rowSeats: [...config.rowSeats]
                        };
                    } else {
                        roomMatrices[room] = {
                            rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS,
                            totalSeats: DEFAULT_ROWS * DEFAULT_COLUMNS,
                            hasCustomRowConfig: false,
                            rowSeats: Array(DEFAULT_ROWS).fill(DEFAULT_COLUMNS)
                        };
                    }
                }
            });
            saveRoomMatrices();
        }

        function saveRoomMatrices() { localStorage.setItem(ROOM_MATRICES_KEY, JSON.stringify(roomMatrices)); }
        function saveDisabledRooms() { localStorage.setItem(DISABLED_ROOMS_KEY, JSON.stringify(disabledRooms)); }

        function getRoomMatrix(roomNo) {
            return roomMatrices[roomNo] || {
                rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS,
                totalSeats: DEFAULT_ROWS * DEFAULT_COLUMNS,
                hasCustomRowConfig: false,
                rowSeats: Array(DEFAULT_ROWS).fill(DEFAULT_COLUMNS)
            };
        }

        function toggleRoomDisabled(roomNo) {
            const index = disabledRooms.indexOf(roomNo);
            if (index === -1) { disabledRooms.push(roomNo); showNotification(`Room ${roomNo} disabled for exams`, 'warning'); }
            else { disabledRooms.splice(index, 1); showNotification(`Room ${roomNo} enabled for exams`, 'success'); }
            saveDisabledRooms();
            renderRoomOrganization();
            updateDisabledRoomsSummary();
        }

        function isRoomDisabled(roomNo) { return disabledRooms.includes(roomNo); }

        function addNewRoom() {
            const roomNo = prompt('Enter new room number (e.g., 3414):');
            if (!roomNo || !/^\d{4}$/.test(roomNo)) { showNotification('Please enter a valid 4-digit room number', 'error'); return; }
            if (getRoomLocation(roomNo)) { showNotification(`Room ${roomNo} already exists`, 'warning'); return; }
            const block = prompt('Enter block (block1 or block3):');
            if (!['block1', 'block3'].includes(block)) { showNotification('Invalid block. Must be block1 or block3', 'error'); return; }
            const floor = prompt('Enter floor number (1-4):');
            if (!['1', '2', '3', '4'].includes(floor)) { showNotification('Invalid floor. Must be 1-4', 'error'); return; }
            if (!roomOrganization[block].floors[floor]) roomOrganization[block].floors[floor] = [];
            roomOrganization[block].floors[floor].push(roomNo);
            roomMatrices[roomNo] = { rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS, totalSeats: DEFAULT_ROWS * DEFAULT_COLUMNS, hasCustomRowConfig: false, rowSeats: Array(DEFAULT_ROWS).fill(DEFAULT_COLUMNS) };
            saveRoomOrganization();
            saveRoomMatrices();
            renderRoomOrganization();
            showNotification(`Room ${roomNo} added to ${block}, floor ${floor}`, 'success');
        }

        function getRoomLocation(roomNo) {
            for (const [blockKey, block] of Object.entries(roomOrganization)) {
                for (const [floor, rooms] of Object.entries(block.floors)) {
                    if (rooms.includes(roomNo)) return { block: blockKey, floor };
                }
            }
            return null;
        }

        function moveRoom(roomNo, newBlock, newFloor) {
            const location = getRoomLocation(roomNo);
            if (!location) return false;
            const oldRooms = roomOrganization[location.block].floors[location.floor];
            const index = oldRooms.indexOf(roomNo);
            if (index > -1) oldRooms.splice(index, 1);
            if (!roomOrganization[newBlock].floors[newFloor]) roomOrganization[newBlock].floors[newFloor] = [];
            roomOrganization[newBlock].floors[newFloor].push(roomNo);
            saveRoomOrganization();
            return true;
        }

        function setupDragAndDrop() {
            const floorContainers = document.querySelectorAll('.floor-container');
            document.addEventListener('dragstart', (e) => {
                if (e.target.classList.contains('room-detail-btn') && !e.target.classList.contains('disabled')) {
                    draggedRoom = e.target.dataset.room;
                    draggedRoomElement = e.target;
                    e.target.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedRoom);
                }
            });
            document.addEventListener('dragend', (e) => {
                if (draggedRoomElement) { draggedRoomElement.classList.remove('dragging'); draggedRoomElement = null; }
                draggedRoom = null;
                floorContainers.forEach(container => container.classList.remove('drag-over'));
            });
            floorContainers.forEach(container => {
                container.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedRoom) { container.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; }
                });
                container.addEventListener('dragleave', (e) => { if (draggedRoom) container.classList.remove('drag-over'); });
                container.addEventListener('drop', (e) => {
                    e.preventDefault();
                    container.classList.remove('drag-over');
                    if (draggedRoom) {
                        const newBlock = container.dataset.block;
                        const newFloor = container.dataset.floor;
                        if (moveRoom(draggedRoom, newBlock, newFloor)) {
                            renderRoomOrganization();
                            showNotification(`Room ${draggedRoom} moved to ${newBlock}, floor ${newFloor}`, 'success');
                        }
                    }
                });
            });
        }

        function renderRoomOrganization() {
            Object.entries(roomOrganization).forEach(([blockKey, block]) => {
                Object.entries(block.floors).forEach(([floor, rooms]) => {
                    const containerId = `${blockKey}-floor${floor}`;
                    const container = document.getElementById(containerId);
                    if (container) {
                        container.innerHTML = '';
                        rooms.forEach(room => {
                            const isDisabled = isRoomDisabled(room);
                            const matrix = getRoomMatrix(room);
                            const button = document.createElement('button');
                            button.className = `room-detail-btn ${isDisabled ? 'disabled' : ''}`;
                            button.draggable = !isDisabled;
                            button.innerHTML = `
                                <div class="room-number">${room}</div>
                                <div class="room-seats">${matrix.totalSeats} seats</div>
                                ${isDisabled ? '<span class="room-status-badge">DISABLED</span>' : ''}
                            `;
                            button.title = isDisabled ? 'Click to enable room' : 'Click to configure or disable (Ctrl+Click to disable). Drag to move.';
                            button.dataset.room = room;
                            button.dataset.block = blockKey;
                            button.dataset.floor = floor;
                            button.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (e.ctrlKey || e.metaKey) toggleRoomDisabled(room);
                                else selectRoomForMatrix(room);
                            });
                            container.appendChild(button);
                        });
                    }
                });
            });
            setupDragAndDrop();
        }

        function updateDisabledRoomsSummary() {
            const summary = document.getElementById('disabled-rooms-summary');
            const grid = document.getElementById('disabled-rooms-grid');
            if (disabledRooms.length > 0) {
                summary.style.display = 'block';
                grid.innerHTML = '';
                disabledRooms.forEach(room => {
                    const matrix = getRoomMatrix(room);
                    const button = document.createElement('button');
                    button.className = 'room-detail-btn disabled';
                    button.innerHTML = `<div class="room-number">${room}</div><div class="room-seats">${matrix.totalSeats} seats</div><span class="room-status-badge">DISABLED</span>`;
                    button.title = 'Click to enable room';
                    button.dataset.room = room;
                    button.addEventListener('click', () => toggleRoomDisabled(room));
                    grid.appendChild(button);
                });
            } else {
                summary.style.display = 'none';
            }
        }

        function selectRoomForMatrix(roomNo) {
            currentSelectedRoomForMatrix = roomNo;
            const matrix = getRoomMatrix(roomNo);
            document.getElementById('selected-room-name').textContent = `Room ${roomNo}`;
            document.getElementById('selected-room-title').textContent = `Configure Room ${roomNo} Matrix`;
            document.getElementById('matrix-configuration').style.display = 'block';
            document.getElementById('rows-input').value = matrix.rows;
            document.getElementById('columns-input').value = matrix.columns;
            document.getElementById('capacity-input').value = matrix.totalSeats;
            isRowWiseConfig = matrix.hasCustomRowConfig;
            const rowWiseConfigDiv = document.getElementById('row-wise-config');
            const rowConfigGrid = document.getElementById('row-config-grid');
            if (isRowWiseConfig) {
                rowWiseConfigDiv.style.display = 'block';
                rowConfigGrid.innerHTML = '';
                for (let i = 0; i < matrix.rows; i++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'row-config-item';
                    rowDiv.innerHTML = `<label>Row ${i + 1} Seats:</label><input type="number" min="1" max="20" value="${matrix.rowSeats[i] || matrix.columns}" class="row-seats-input" data-row="${i}">`;
                    rowConfigGrid.appendChild(rowDiv);
                }
                document.querySelectorAll('.row-seats-input').forEach(input => input.addEventListener('input', updateRowWiseMatrix));
            } else {
                rowWiseConfigDiv.style.display = 'none';
            }
            updateMatrixPreview();
            scrollToMatrixConfiguration();
        }

        function updateMatrixPreview() {
            const rows = parseInt(document.getElementById('rows-input').value) || 0;
            const columns = parseInt(document.getElementById('columns-input').value) || 0;
            let totalSeats = 0;
            const visualContainer = document.getElementById('matrix-visual-container');
            visualContainer.innerHTML = '';
            if (isRowWiseConfig) {
                const rowSeats = [];
                document.querySelectorAll('.row-seats-input').forEach(input => {
                    const seats = parseInt(input.value) || 0;
                    rowSeats.push(seats);
                    totalSeats += seats;
                });
                const matrixVisual = document.createElement('div');
                matrixVisual.className = 'matrix-visual';
                rowSeats.forEach(seats => {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'matrix-row';
                    rowDiv.style.justifyContent = 'center';
                    for (let col = 0; col < seats; col++) {
                        const cell = document.createElement('div');
                        cell.className = 'matrix-cell filled';
                        cell.textContent = 'S';
                        rowDiv.appendChild(cell);
                    }
                    matrixVisual.appendChild(rowDiv);
                });
                visualContainer.appendChild(matrixVisual);
            } else {
                totalSeats = rows * columns;
                const matrixVisual = document.createElement('div');
                matrixVisual.className = 'matrix-visual';
                matrixVisual.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
                for (let i = 0; i < rows * columns; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'matrix-cell filled';
                    cell.textContent = 'S';
                    matrixVisual.appendChild(cell);
                }
                visualContainer.appendChild(matrixVisual);
            }
            document.getElementById('total-seats').textContent = totalSeats;
            document.getElementById('capacity-input').value = totalSeats;
        }

        function updateRowWiseMatrix() {
            let maxColumns = 0;
            document.querySelectorAll('.row-seats-input').forEach(input => {
                const seats = parseInt(input.value) || 0;
                if (seats > maxColumns) maxColumns = seats;
            });
            document.getElementById('columns-input').value = maxColumns;
            updateMatrixPreview();
        }

        function setDefaultMatrix() {
            document.getElementById('rows-input').value = DEFAULT_ROWS;
            document.getElementById('columns-input').value = DEFAULT_COLUMNS;
            isRowWiseConfig = false;
            document.getElementById('row-wise-config').style.display = 'none';
            updateMatrixPreview();
            showNotification('Matrix reset to default (5×9)', 'success');
        }

        function saveMatrixConfiguration() {
            if (!currentSelectedRoomForMatrix) return;
            const rows = parseInt(document.getElementById('rows-input').value);
            const columns = parseInt(document.getElementById('columns-input').value);
            if (rows < 1 || columns < 1) { showNotification('Please enter valid row and column numbers', 'warning'); return; }
            let totalSeats = 0;
            let rowSeats = [];
            if (isRowWiseConfig) {
                document.querySelectorAll('.row-seats-input').forEach(input => {
                    const seats = parseInt(input.value) || 0;
                    if (seats < 1) { showNotification(`Row ${parseInt(input.dataset.row) + 1} must have at least 1 seat`, 'warning'); return; }
                    rowSeats.push(seats);
                    totalSeats += seats;
                });
                if (rowSeats.length !== rows) { showNotification('Row seat configuration does not match number of rows', 'error'); return; }
            } else {
                totalSeats = rows * columns;
                rowSeats = Array(rows).fill(columns);
            }
            roomMatrices[currentSelectedRoomForMatrix] = { rows, columns, totalSeats, hasCustomRowConfig: isRowWiseConfig, rowSeats };
            saveRoomMatrices();
            document.getElementById('matrix-configuration').style.display = 'none';
            renderRoomOrganization();
            showNotification(`Matrix configuration saved for Room ${currentSelectedRoomForMatrix}`, 'success');
        }

        function cancelMatrixConfiguration() {
            document.getElementById('matrix-configuration').style.display = 'none';
            currentSelectedRoomForMatrix = null;
        }

        function scrollToMatrixConfiguration() {
            document.getElementById('matrix-configuration').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function calculateFineForRollNo(rollNo) {
            return absentees.filter(a => a.rollNo === rollNo).length * FINE_PER_ABSENT;
        }

        function calculateTotalFine() {
            const rollNoCount = {};
            absentees.forEach(a => { rollNoCount[a.rollNo] = (rollNoCount[a.rollNo] || 0) + 1; });
            return Object.values(rollNoCount).reduce((sum, count) => sum + count * FINE_PER_ABSENT, 0);
        }

        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-circle' : 'times-circle'}"></i> ${message}`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.classList.add('show');
                setTimeout(() => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 400); }, 3000);
            }, 100);
        }

        function loadDefaultRow() {
            const inputBody = document.getElementById('input-body');
            if (inputBody.children.length === 0) inputBody.appendChild(createInputRow());
        }

        function createInputRow(data = {}) {
            const tr = document.createElement('tr');
            const deptEntries = data.departments && data.departments.length > 0 ? data.departments : [{ dept: '', year: '', subject: '', rollRange: '' }];
            const deptEntriesHtml = deptEntries.map((entry, index) => `
                <div class="dept-entry">
                    <div class="dept-entry-header">
                        <h4>Department Entry ${index + 1}</h4>
                        <button type="button" class="remove-dept-btn" onclick="removeDeptEntry(this)"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="dept-entry-grid">
                        <select class="dept-select">
                            <option value="">Select Dept</option>
                            <option value="CSE" ${entry.dept === 'CSE' ? 'selected' : ''}>Computer Science</option>
                            <option value="IT" ${entry.dept === 'IT' ? 'selected' : ''}>Information Technology</option>
                            <option value="ECE" ${entry.dept === 'ECE' ? 'selected' : ''}>Electronics</option>
                            <option value="MECH" ${entry.dept === 'MECH' ? 'selected' : ''}>Mechanical</option>
                            <option value="CIVIL" ${entry.dept === 'CIVIL' ? 'selected' : ''}>Civil Engineering</option>
                            <option value="EEE" ${entry.dept === 'EEE' ? 'selected' : ''}>Electrical Engineering</option>
                            <option value="CHEM" ${entry.dept === 'CHEM' ? 'selected' : ''}>Chemical Engineering</option>
                            <option value="AERO" ${entry.dept === 'AERO' ? 'selected' : ''}>Aeronautical Engineering</option>
                            <option value="BIO" ${entry.dept === 'BIO' ? 'selected' : ''}>Biotechnology</option>
                            <option value="AI" ${entry.dept === 'AI' ? 'selected' : ''}>Artificial Intelligence</option>
                        </select>
                        <select class="year-select">
                            <option value="">Select Year</option>
                            <option value="1" ${entry.year === '1' ? 'selected' : ''}>1st Year</option>
                            <option value="2" ${entry.year === '2' ? 'selected' : ''}>2nd Year</option>
                            <option value="3" ${entry.year === '3' ? 'selected' : ''}>3rd Year</option>
                            <option value="4" ${entry.year === '4' ? 'selected' : ''}>4th Year</option>
                        </select>
                        <input type="text" class="subject-input" placeholder="e.g., Mathematics" value="${entry.subject || ''}">
                        <input type="text" class="roll-range" placeholder="e.g., CS101-CS115" value="${entry.rollRange || ''}">
                    </div>
                </div>
            `).join('');
            tr.innerHTML = `
                <td><input type="text" placeholder="e.g., 201" value="${data.roomNo || ''}"></td>
                <td>
                    <div class="dept-container">${deptEntriesHtml}</div>
                    <button type="button" class="add-dept-btn" onclick="addDeptEntry(this)"><i class="fas fa-plus"></i> Add Department</button>
                </td>
                <td><textarea placeholder="Enter staff names (one per line)" rows="3">${data.staff || ''}</textarea></td>
                <td><button class="delete-btn"><i class="fas fa-trash"></i> Delete</button></td>
            `;
            return tr;
        }

        function addDeptEntry(button) {
            const deptContainer = button.parentElement.querySelector('.dept-container');
            const entryCount = deptContainer.querySelectorAll('.dept-entry').length + 1;
            const newEntry = document.createElement('div');
            newEntry.className = 'dept-entry';
            newEntry.innerHTML = `
                <div class="dept-entry-header">
                    <h4>Department Entry ${entryCount}</h4>
                    <button type="button" class="remove-dept-btn" onclick="removeDeptEntry(this)"><i class="fas fa-times"></i></button>
                </div>
                <div class="dept-entry-grid">
                    <select class="dept-select">
                        <option value="">Select Dept</option>
                        <option value="CSE">Computer Science</option>
                        <option value="IT">Information Technology</option>
                        <option value="ECE">Electronics</option>
                        <option value="MECH">Mechanical</option>
                        <option value="CIVIL">Civil Engineering</option>
                        <option value="EEE">Electrical Engineering</option>
                        <option value="CHEM">Chemical Engineering</option>
                        <option value="AERO">Aeronautical Engineering</option>
                        <option value="BIO">Biotechnology</option>
                        <option value="AI">Artificial Intelligence</option>
                    </select>
                    <select class="year-select">
                        <option value="">Select Year</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                    </select>
                    <input type="text" class="subject-input" placeholder="e.g., Mathematics">
                    <input type="text" class="roll-range" placeholder="e.g., CS101-CS115">
                </div>
            `;
            deptContainer.appendChild(newEntry);
            showNotification('Department entry added', 'success');
        }

        function removeDeptEntry(button) {
            const deptContainer = button.closest('.dept-container');
            const entries = deptContainer.querySelectorAll('.dept-entry');
            if (entries.length > 1) {
                button.closest('.dept-entry').remove();
                Array.from(deptContainer.querySelectorAll('.dept-entry')).forEach((entry, index) => {
                    entry.querySelector('h4').textContent = `Department Entry ${index + 1}`;
                });
                showNotification('Department entry removed', 'success');
            } else {
                showNotification('At least one department entry must remain', 'warning');
            }
        }

        function attachDeleteListeners() {
            const inputBody = document.getElementById('input-body');
            inputBody.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (inputBody.children.length > 1) { btn.closest('tr').remove(); showNotification('Room row deleted', 'success'); }
                    else showNotification('At least one room must remain', 'warning');
                });
            });
        }

        function updateFacultySlots() {
            const slotsContainer = document.getElementById('faculty-slots');
            if (!slotsContainer) return;
            slotsContainer.innerHTML = '';
            const allFaculty = facultyWorkload.getAllFaculty();
            if (allFaculty.length === 0) { slotsContainer.innerHTML = '<p class="no-faculty">No faculty assigned yet</p>'; return; }
            const facultyByUnit = {};
            allFaculty.forEach(faculty => {
                Object.keys(faculty.assignments).forEach(unit => {
                    if (!facultyByUnit[unit]) facultyByUnit[unit] = [];
                    facultyByUnit[unit].push({ name: faculty.name, assignments: faculty.assignments[unit], unit });
                });
            });
            Object.keys(facultyByUnit).sort().forEach(unit => {
                const unitHeader = document.createElement('h4');
                unitHeader.textContent = `Unit ${unit}`;
                unitHeader.style.cssText = 'margin-top:20px;color:var(--primary-color)';
                slotsContainer.appendChild(unitHeader);
                facultyByUnit[unit].forEach(faculty => {
                    const slot = document.createElement('div');
                    slot.className = `faculty-slot ${faculty.assignments.length >= 3 ? 'overloaded' : ''}`;
                    const assignmentDates = faculty.assignments.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ');
                    slot.innerHTML = `
                        <div class="faculty-info">
                            <span class="faculty-name">${faculty.name}</span>
                            <span class="assignment-count ${faculty.assignments.length >= 3 ? 'warning' : ''}">${faculty.assignments.length}/3</span>
                        </div>
                        <div class="assignment-dates">${assignmentDates}</div>
                        ${faculty.assignments.length >= 3 ? '<div class="overload-warning">⚠️ Maximum workload reached</div>' : ''}
                    `;
                    slotsContainer.appendChild(slot);
                });
            });
        }

        function validateAndProcessStaff(staffNames, examDate, unit) {
            const staffArray = staffNames.split('\n').map(s => s.trim()).filter(s => s);
            const validStaff = [];
            const overloadedStaff = [];
            staffArray.forEach(staffName => {
                if (!facultyWorkload.canAssign(staffName, unit)) overloadedStaff.push(staffName);
                else { validStaff.push(staffName); facultyWorkload.addAssignment(staffName, examDate, unit); }
            });
            if (overloadedStaff.length > 0) { showFacultyOverloadWarning(overloadedStaff, unit); return null; }
            updateFacultySlots();
            return validStaff;
        }

        function showFacultyOverloadWarning(overloadedStaff, unit) {
            const modal = document.createElement('div');
            modal.className = 'faculty-warning-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header"><h3><i class="fas fa-exclamation-triangle"></i> Faculty Workload Warning</h3></div>
                    <div class="modal-body">
                        <p>The following faculty members have reached their maximum workload (3 assignments) for Unit ${unit}:</p>
                        <ul>${overloadedStaff.map(name => `<li>${name} (${facultyWorkload.getAssignmentCount(name, unit)}/3 assignments)</li>`).join('')}</ul>
                        <p>Please either:</p>
                        <ul><li>Remove these faculty members from the assignment</li><li>Choose different faculty members</li><li>Reset faculty workload if needed</li></ul>
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
                        <button class="modal-btn primary" onclick="showResetConfirmation()">Reset Faculty Workload</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            window.closeModal = function() { modal.remove(); delete window.closeModal; delete window.showResetConfirmation; };
            window.showResetConfirmation = function() { if (confirm('Are you sure you want to reset all faculty workload data?')) { resetAllFaculty(); closeModal(); } };
        }

        function resetAllFaculty() {
            if (confirm('This will permanently delete all faculty workload records. Are you sure?')) {
                facultyWorkload.reset();
                updateFacultySlots();
                showNotification('All faculty workload data has been reset', 'success');
            }
        }

        function loadSavedArrangements() {
            const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
            const savedArrangementsGrid = document.getElementById('saved-arrangements-grid');
            const noSavedData = document.getElementById('no-saved-data');
            savedArrangementsGrid.innerHTML = '';
            const filteredArrangements = currentUnitFilter === 'all' ? savedArrangements : savedArrangements.filter(arr => arr.unit === currentUnitFilter);
            noSavedData.style.display = filteredArrangements.length ? 'none' : 'block';
            filteredArrangements.forEach((arrangement, index) => {
                const card = document.createElement('div');
                card.className = 'saved-arrangement-card';
                const dateObj = new Date(arrangement.date);
                const day = dateObj.toLocaleString('en-US', { weekday: 'long' });
                const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const formattedTime = new Date(`1970-01-01T${arrangement.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                const roomCount = arrangement.generatedData.length;
                const totalStudents = arrangement.generatedData.reduce((sum, room) => sum + room.seats.filter(seat => !seat.isEmpty).length, 0);
                card.innerHTML = `
                    <div class="saved-card-header">
                        <span class="saved-card-date">${formattedDate}</span>
                        <span class="saved-card-day">${day}</span>
                    </div>
                    <div class="saved-card-info">
                        <p><strong>Unit:</strong> ${arrangement.unit}</p>
                        <p><strong>Time:</strong> ${formattedTime}</p>
                    </div>
                    <div class="saved-card-stats">
                        <span><strong>Rooms:</strong> ${roomCount}</span>
                        <span><strong>Students:</strong> ${totalStudents}</span>
                    </div>
                    <div class="saved-card-actions">
                        <button class="view-btn" data-index="${savedArrangements.indexOf(arrangement)}"><i class="fas fa-eye"></i> View</button>
                        <button class="delete-saved-btn" data-index="${savedArrangements.indexOf(arrangement)}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                `;
                savedArrangementsGrid.appendChild(card);
            });
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
                    loadArrangement(savedArrangements[btn.dataset.index]);
                });
            });
            document.querySelectorAll('.delete-saved-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to delete this saved arrangement?')) {
                        const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
                        savedArrangements.splice(btn.dataset.index, 1);
                        localStorage.setItem('savedArrangements', JSON.stringify(savedArrangements));
                        loadSavedArrangements();
                        loadUnitButtons();
                        showNotification('Saved arrangement deleted', 'success');
                    }
                });
            });
        }

        // Helper: build seat boxes for a room card
        function buildSeatContainer(seatContainer, roomNo, seats) {
            const roomMatrix = getRoomMatrix(roomNo);
            if (roomMatrix.hasCustomRowConfig) {
                seatContainer.style.display = 'flex';
                seatContainer.style.flexDirection = 'column';
                seatContainer.style.gap = '8px';
                let seatIndex = 0;
                for (let row = 0; row < roomMatrix.rows; row++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.style.cssText = 'display:flex;gap:8px;justify-content:center';
                    const seatsInRow = roomMatrix.rowSeats[row] || roomMatrix.columns;
                    for (let col = 0; col < seatsInRow; col++) {
                        rowDiv.appendChild(createSeatBox(seats[seatIndex]));
                        seatIndex++;
                    }
                    seatContainer.appendChild(rowDiv);
                }
            } else {
                seatContainer.style.gridTemplateColumns = `repeat(${roomMatrix.columns}, 45px)`;
                seatContainer.style.justifyContent = 'center';
                seats.forEach(seat => seatContainer.appendChild(createSeatBox(seat)));
            }
        }

        function createSeatBox(seat, isAttendance = false, roomTitle = '') {
            const seatBox = document.createElement('div');
            if (seat && !seat.isEmpty) {
                const isAbsent = isAttendance && absentees.some(a =>
                    a.rollNo === seat.rollNo && a.date === selectedArrangement.date && a.room === roomTitle
                );
                seatBox.className = `seat-box ${isAbsent ? 'absent' : ''}`;
                seatBox.style.setProperty('--dept-color', seat.deptColor);
                seatBox.style.setProperty('--year-color', seat.yearColor);
                seatBox.dataset.dept = seat.dept;
                seatBox.dataset.year = seat.year;
                seatBox.dataset.rollNo = seat.rollNo;
                seatBox.dataset.subject = seat.subject;
                seatBox.innerHTML = `<span class="roll-label">Roll No</span><span class="roll-no">${seat.rollNo}</span><span class="staff">${seat.staff}</span>`;
                if (isAttendance) seatBox.addEventListener('click', () => toggleAttendance(seat, roomTitle));
            } else {
                seatBox.className = 'seat-box empty';
                seatBox.innerHTML = `<span class="roll-label">Roll No</span><span class="roll-no">Empty</span><span class="staff"></span>`;
            }
            return seatBox;
        }

        function loadArrangement(arrangement) {
            selectedArrangement = arrangement;
            document.getElementById('exam-unit').value = arrangement.unit;
            document.getElementById('exam-date').value = arrangement.date;
            document.getElementById('exam-time').value = arrangement.time;
            updateExamInfoDisplay();
            const inputBody = document.getElementById('input-body');
            inputBody.innerHTML = '';
            arrangement.inputData.forEach(data => inputBody.appendChild(createInputRow(data)));
            const roomGrid = document.getElementById('room-grid');
            roomGrid.innerHTML = '';
            arrangement.generatedData.forEach(room => {
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                roomCard.innerHTML = `<div class="room-title">${room.title}</div><div class="seat-container"></div>`;
                const roomNo = room.title.replace('Room ', '').trim();
                buildSeatContainer(roomCard.querySelector('.seat-container'), roomNo, room.seats);
                roomGrid.appendChild(roomCard);
            });
            attachDeleteListeners();
            toggleNoData();
            switchSection('configure');
            showNotification('Arrangement loaded successfully', 'success');
        }

        function loadUnitButtons() {
            const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
            const unitSelection = document.getElementById('unit-selection');
            unitSelection.innerHTML = '';
            const arrangementsByUnit = {};
            savedArrangements.forEach(arr => {
                if (!arrangementsByUnit[arr.unit]) arrangementsByUnit[arr.unit] = [];
                arrangementsByUnit[arr.unit].push(arr);
            });
            const sortedUnits = Object.keys(arrangementsByUnit).sort((a, b) => a - b);
            sortedUnits.forEach(unit => {
                const uniqueDates = [...new Set(arrangementsByUnit[unit].map(arr => arr.date))].sort();
                uniqueDates.forEach(date => {
                    const unitArrangements = arrangementsByUnit[unit].filter(arr => arr.date === date);
                    const times = unitArrangements.map(arr => new Date(`1970-01-01T${arr.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
                    const dateObj = new Date(date);
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const day = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    let totalRooms = 0, totalStudents = 0;
                    unitArrangements.forEach(arr => {
                        totalRooms += arr.generatedData.length;
                        totalStudents += arr.generatedData.reduce((sum, room) => sum + room.seats.filter(seat => !seat.isEmpty).length, 0);
                    });
                    const button = document.createElement('button');
                    button.className = 'unit-btn';
                    button.innerHTML = `
                        <div class="unit-title">Unit ${unit}</div>
                        <div><i class="fas fa-calendar"></i> ${formattedDate}</div>
                        <div><i class="fas fa-clock"></i> ${times.join(', ')}</div>
                        <div class="unit-date">${day}</div>
                        <div class="room-stats">${totalRooms} rooms, ${totalStudents} students</div>
                    `;
                    button.dataset.unit = unit;
                    button.dataset.date = date;
                    button.addEventListener('click', () => selectUnitForAttendance(unit, date));
                    unitSelection.appendChild(button);
                });
            });
            unitSelection.style.display = sortedUnits.length > 0 ? 'grid' : 'none';
            if (sortedUnits.length === 0) unitSelection.innerHTML = '<p class="no-data">No units available for attendance</p>';
        }

        function selectUnitForAttendance(unit, date) {
            selectedUnit = unit;
            document.getElementById('unit-selection').style.display = 'none';
            document.getElementById('room-selection').style.display = 'grid';
            loadRoomButtons(unit, date);
        }

        function loadRoomButtons(unit, date) {
            const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
            const roomSelection = document.getElementById('room-selection');
            roomSelection.innerHTML = '';
            roomsForAttendance = [];
            const unitDateArrangements = savedArrangements.filter(arr => arr.unit === unit && arr.date === date);
            unitDateArrangements.forEach(arrangement => {
                arrangement.generatedData.forEach(room => {
                    const roomKey = room.title;
                    if (!roomsForAttendance.some(r => r.title === roomKey)) {
                        const studentCount = room.seats.filter(seat => !seat.isEmpty).length;
                        roomsForAttendance.push({ title: roomKey, arrangement, studentCount });
                        const button = document.createElement('button');
                        button.className = 'room-btn';
                        button.innerHTML = `<div>${room.title}</div><div class="room-stats">${studentCount} students</div>`;
                        button.addEventListener('click', () => selectRoom(arrangement, room.title));
                        roomSelection.appendChild(button);
                    }
                });
            });
            roomSelection.style.display = roomsForAttendance.length > 0 ? 'grid' : 'none';
            if (roomsForAttendance.length === 0) roomSelection.innerHTML = '<p class="no-data">No rooms available for this unit and date</p>';
        }

        function selectRoom(arrangement, roomTitle) {
            selectedArrangement = arrangement;
            selectedRoom = roomTitle;
            currentRoomIndex = roomsForAttendance.findIndex(room => room.title === roomTitle);
            document.getElementById('room-selection').style.display = 'none';
            document.getElementById('attendance-grid').classList.add('active');
            loadAttendanceView();
            showNotification('Ready to mark attendance', 'success');
        }

        function loadAttendanceView() {
            if (!selectedArrangement || !selectedRoom) return;
            const dateObj = new Date(selectedArrangement.date);
            const day = dateObj.toLocaleString('en-US', { weekday: 'long' });
            const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const formattedTime = new Date(`1970-01-01T${selectedArrangement.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
            document.getElementById('attendance-exam-title').textContent = `Attendance for ${selectedRoom} (Unit ${selectedArrangement.unit})`;
            document.getElementById('attendance-exam-details').textContent = `Scheduled for ${formattedDate} at ${formattedTime} (${day})`;
            document.getElementById('attendance-room-grid').innerHTML = '';
            const roomData = selectedArrangement.generatedData.find(room => room.title === selectedRoom);
            if (!roomData) return;
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `<div class="room-title">${selectedRoom}</div><div class="seat-container"></div>`;
            const seatContainer = roomCard.querySelector('.seat-container');
            const roomNo = selectedRoom.replace('Room ', '').trim();
            const roomMatrix = getRoomMatrix(roomNo);
            if (roomMatrix.hasCustomRowConfig) {
                seatContainer.style.display = 'flex';
                seatContainer.style.flexDirection = 'column';
                seatContainer.style.gap = '8px';
                let seatIndex = 0;
                for (let row = 0; row < roomMatrix.rows; row++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.style.cssText = 'display:flex;gap:8px;justify-content:center';
                    const seatsInRow = roomMatrix.rowSeats[row] || roomMatrix.columns;
                    for (let col = 0; col < seatsInRow; col++) {
                        const seat = roomData.seats[seatIndex];
                        rowDiv.appendChild(createSeatBox(seat, true, selectedRoom));
                        seatIndex++;
                    }
                    seatContainer.appendChild(rowDiv);
                }
            } else {
                seatContainer.style.gridTemplateColumns = `repeat(${roomMatrix.columns}, 45px)`;
                seatContainer.style.justifyContent = 'center';
                roomData.seats.forEach(seat => seatContainer.appendChild(createSeatBox(seat, true, selectedRoom)));
            }
            document.getElementById('attendance-room-grid').appendChild(roomCard);
            updateAbsenteesTable();
        }

        function toggleAttendance(seat, roomTitle) {
            const absenteeRecord = {
                rollNo: seat.rollNo, dept: seat.dept, year: seat.year, subject: seat.subject,
                date: selectedArrangement.date, day: new Date(selectedArrangement.date).toLocaleString('en-US', { weekday: 'long' }),
                room: roomTitle, unit: selectedArrangement.unit, fine: FINE_PER_ABSENT
            };
            const existingIndex = absentees.findIndex(a => a.rollNo === seat.rollNo && a.date === selectedArrangement.date && a.room === roomTitle);
            if (existingIndex === -1) { absentees.push(absenteeRecord); showNotification(`${seat.rollNo} marked as absent. Fine: ₹${FINE_PER_ABSENT}`, 'warning'); }
            else { absentees.splice(existingIndex, 1); showNotification(`${seat.rollNo} marked as present. Fine removed.`, 'success'); }
            localStorage.setItem('absentees', JSON.stringify(absentees));
            loadAttendanceView();
            updateAbsenteesTable();
        }

        function updateAbsenteesTable() {
            const absenteesBody = document.getElementById('absentees-body');
            const noAbsentees = document.getElementById('no-absentees');
            const totalFineSummary = document.getElementById('total-fine-summary');
            const totalFineAmount = document.getElementById('total-fine-amount');
            absenteesBody.innerHTML = '';
            noAbsentees.style.display = absentees.length ? 'none' : 'block';
            if (absentees.length > 0) {
                totalFineSummary.style.display = 'block';
                totalFineAmount.textContent = `₹ ${calculateTotalFine()}`;
            } else {
                totalFineSummary.style.display = 'none';
            }
            absentees.forEach((absentee, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${absentee.rollNo}</td><td>${absentee.dept}</td><td>${absentee.year}</td>
                    <td>${absentee.subject}</td><td>${absentee.unit}</td>
                    <td>${new Date(absentee.date).toLocaleDateString('en-US')}</td>
                    <td>${absentee.day}</td>
                    <td><span class="fine-amount">₹ ${calculateFineForRollNo(absentee.rollNo)}</span></td>
                    <td><button class="delete-absentee-btn" data-index="${index}"><i class="fas fa-trash"></i> Delete</button></td>
                `;
                absenteesBody.appendChild(row);
            });
            document.querySelectorAll('.delete-absentee-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.closest('.delete-absentee-btn').dataset.index);
                    if (confirm('Are you sure you want to remove this absentee record?')) {
                        const removed = absentees[index];
                        absentees.splice(index, 1);
                        localStorage.setItem('absentees', JSON.stringify(absentees));
                        updateAbsenteesTable();
                        showNotification(`Absentee record deleted for ${removed.rollNo}. Fine reduced by ₹${FINE_PER_ABSENT}`, 'success');
                    }
                });
            });
        }

        function showAbsenteesTable() {
            document.getElementById('unit-selection').style.display = 'none';
            document.getElementById('room-selection').style.display = 'none';
            document.getElementById('attendance-grid').style.display = 'none';
            document.getElementById('absentees-section').style.display = 'block';
            updateAbsenteesTable();
        }

        function updateExamInfoDisplay() {
            const unit = document.getElementById('exam-unit').value;
            const date = document.getElementById('exam-date').value;
            const time = document.getElementById('exam-time').value;
            const examInfoDisplay = document.getElementById('exam-info-display');
            const examHeader = document.getElementById('exam-header');
            const examDetails = document.getElementById('exam-details');
            if (unit && date && time) {
                const dateObj = new Date(date);
                const day = dateObj.toLocaleString('en-US', { weekday: 'long' });
                const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const formattedTime = new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                document.getElementById('exam-info-text').textContent = `Unit ${unit} - ${formattedDate} at ${formattedTime} (${day})`;
                examInfoDisplay.style.display = 'block';
                examHeader.style.display = 'block';
                examDetails.textContent = `Unit ${unit} scheduled for ${formattedDate} at ${formattedTime} (${day})`;
            } else {
                examInfoDisplay.style.display = 'none';
                examHeader.style.display = 'none';
            }
        }

        function toggleNoData() {
            const roomGrid = document.getElementById('room-grid');
            document.getElementById('no-data').style.display = roomGrid.children.length ? 'none' : 'block';
        }

        function switchSection(section) {
            document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
            document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('configure-header').style.display = section === 'configure' ? 'block' : 'none';
            if (section === 'configure') {
                document.getElementById('nav-configure').classList.add('active');
                document.getElementById('configure-section').classList.add('active');
            } else if (section === 'saved') {
                document.getElementById('nav-saved').classList.add('active');
                document.getElementById('saved-section').classList.add('active');
            } else if (section === 'faculty') {
                document.getElementById('nav-faculty').classList.add('active');
                document.getElementById('faculty-section').classList.add('active');
            } else if (section === 'attendance') {
                document.getElementById('nav-attendance').classList.add('active');
                document.getElementById('attendance-section').classList.add('active');
                document.getElementById('attendance-grid').classList.remove('active');
                document.getElementById('unit-selection').style.display = 'grid';
                document.getElementById('room-selection').style.display = 'none';
                document.getElementById('absentees-section').style.display = 'none';
            } else if (section === 'room-details') {
                document.getElementById('nav-room-details').classList.add('active');
                document.getElementById('room-details-section').classList.add('active');
                document.getElementById('matrix-configuration').style.display = 'none';
            }
        }

        function initializeRoomDetails() {
            initializeRoomMatrices();
            renderRoomOrganization();
            updateDisabledRoomsSummary();
            document.getElementById('rows-input').addEventListener('input', updateMatrixPreview);
            document.getElementById('columns-input').addEventListener('input', updateMatrixPreview);
            document.getElementById('set-default-btn').addEventListener('click', setDefaultMatrix);
            document.getElementById('cancel-matrix-btn').addEventListener('click', cancelMatrixConfiguration);
            document.getElementById('save-matrix-btn').addEventListener('click', saveMatrixConfiguration);
            document.getElementById('add-new-room-btn').addEventListener('click', addNewRoom);
        }

        function initialize() {
            loadDefaultRow();
            updateExamInfoDisplay();
            loadSavedArrangements();
            toggleNoData();
            attachDeleteListeners();
            updateFacultySlots();
            loadUnitButtons();
            updateAbsenteesTable();
            initializeRoomDetails();
            document.getElementById('nav-configure').addEventListener('click', () => switchSection('configure'));
            document.getElementById('nav-saved').addEventListener('click', () => switchSection('saved'));
            document.getElementById('nav-faculty').addEventListener('click', () => switchSection('faculty'));
            document.getElementById('nav-attendance').addEventListener('click', () => switchSection('attendance'));
            document.getElementById('nav-room-details').addEventListener('click', () => switchSection('room-details'));
            document.querySelectorAll('.unit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentUnitFilter = btn.dataset.unit;
                    loadSavedArrangements();
                });
            });
            document.getElementById('faculty-reset-btn').addEventListener('click', resetAllFaculty);
            document.getElementById('show-absentees-btn').addEventListener('click', showAbsenteesTable);
            document.getElementById('show-absentees-bottom-btn').addEventListener('click', showAbsenteesTable);
            document.getElementById('next-room-btn').addEventListener('click', () => {
                if (roomsForAttendance.length === 0) return;
                currentRoomIndex = (currentRoomIndex + 1) % roomsForAttendance.length;
                const nextRoom = roomsForAttendance[currentRoomIndex];
                selectRoom(nextRoom.arrangement, nextRoom.title);
            });
            document.getElementById('generate-btn').addEventListener('click', generateSeatingArrangement);
            document.getElementById('add-row-btn').addEventListener('click', () => {
                document.getElementById('input-body').appendChild(createInputRow());
                attachDeleteListeners();
                showNotification('New room row added', 'success');
            });
            document.getElementById('exam-unit').addEventListener('change', updateExamInfoDisplay);
            document.getElementById('exam-date').addEventListener('change', updateExamInfoDisplay);
            document.getElementById('exam-time').addEventListener('change', updateExamInfoDisplay);
            document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('excel-upload').click());
            document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);
            document.getElementById('arrange-btn').addEventListener('click', arrangeSeats);
            document.getElementById('clear-btn').addEventListener('click', clearAllData);
            document.getElementById('save-btn').addEventListener('click', saveArrangement);
        }

        function generateSeatingArrangement() {
            const examUnit = document.getElementById('exam-unit');
            const examDate = document.getElementById('exam-date');
            const examTime = document.getElementById('exam-time');
            if (!examUnit.value || !examDate.value || !examTime.value) { showNotification('Please select exam unit, date and time', 'warning'); return; }
            const rows = document.getElementById('input-body').querySelectorAll('tr');
            if (rows.length === 0) { showNotification('Please add at least one room', 'warning'); return; }
            const roomGrid = document.getElementById('room-grid');
            roomGrid.innerHTML = '';
            let allValid = true;
            const roomGroups = {};
            rows.forEach(row => {
                const roomNo = row.querySelector('input').value;
                const staffNames = row.querySelector('textarea').value;
                const deptEntries = row.querySelectorAll('.dept-entry');
                if (!roomNo || !staffNames || deptEntries.length === 0) { allValid = false; showNotification('Please fill all fields correctly', 'warning'); return; }
                const validStaff = validateAndProcessStaff(staffNames, examDate.value, examUnit.value);
                if (validStaff === null) { allValid = false; return; }
                if (validStaff.length === 0) { allValid = false; showNotification('Please provide at least one staff name', 'warning'); return; }
                if (!roomGroups[roomNo]) roomGroups[roomNo] = { seats: [] };
                let staffIndex = 0;
                let totalSeats = 0;
                deptEntries.forEach(entry => {
                    const dept = entry.querySelector('.dept-select').value;
                    const year = entry.querySelector('.year-select').value;
                    const subject = entry.querySelector('.subject-input').value;
                    const rollRange = entry.querySelector('.roll-range').value;
                    if (!dept || !year || !subject || !rollRange) { allValid = false; showNotification('Please fill all department entry fields including subject', 'warning'); return; }
                    const [startRoll, endRoll] = rollRange.split('-').map(s => s.trim());
                    if (!startRoll || !endRoll) { allValid = false; showNotification('Invalid roll number range format. Use CS101-CS115', 'error'); return; }
                    const startNum = parseInt(startRoll.slice(-3));
                    const endNum = parseInt(endRoll.slice(-3));
                    const prefix = startRoll.slice(0, -3);
                    if (isNaN(startNum) || isNaN(endNum) || startNum >= endNum) { allValid = false; showNotification('Invalid roll number range', 'error'); return; }
                    totalSeats += endNum - startNum + 1;
                    const currentStaff = validStaff[staffIndex % validStaff.length] || 'No Staff';
                    staffIndex++;
                    for (let i = startNum; i <= endNum; i++) {
                        roomGroups[roomNo].seats.push({
                            rollNo: `${prefix}${String(i).padStart(3, '0')}`, dept, year, subject,
                            staff: currentStaff, deptColor: deptColors[dept] || '#999', yearColor: yearColors[year] || '#ccc'
                        });
                    }
                });
                const roomMatrix = getRoomMatrix(roomNo);
                if (totalSeats > roomMatrix.totalSeats) { allValid = false; showNotification(`Room ${roomNo} exceeds maximum capacity of ${roomMatrix.totalSeats} seats`, 'error'); return; }
            });
            if (!allValid) return;
            Object.entries(roomGroups).forEach(([key, data]) => {
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                roomCard.innerHTML = `<div class="room-title">Room ${key}</div><div class="seat-container"></div>`;
                const seatContainer = roomCard.querySelector('.seat-container');
                const roomMatrix = getRoomMatrix(key);
                if (roomMatrix.hasCustomRowConfig) {
                    seatContainer.style.display = 'flex';
                    seatContainer.style.flexDirection = 'column';
                    seatContainer.style.gap = '8px';
                    let seatIndex = 0;
                    for (let row = 0; row < roomMatrix.rows; row++) {
                        const rowDiv = document.createElement('div');
                        rowDiv.style.cssText = 'display:flex;gap:8px;justify-content:center';
                        const seatsInRow = roomMatrix.rowSeats[row] || roomMatrix.columns;
                        for (let col = 0; col < seatsInRow; col++) {
                            rowDiv.appendChild(createSeatBox(data.seats[seatIndex]));
                            seatIndex++;
                        }
                        seatContainer.appendChild(rowDiv);
                    }
                } else {
                    seatContainer.style.gridTemplateColumns = `repeat(${roomMatrix.columns}, 45px)`;
                    seatContainer.style.justifyContent = 'center';
                    const totalSeats = roomMatrix.rows * roomMatrix.columns;
                    for (let i = 0; i < totalSeats; i++) seatContainer.appendChild(createSeatBox(data.seats[i]));
                }
                roomGrid.appendChild(roomCard);
            });
            toggleNoData();
            updateFacultySlots();
            showNotification('Seating arrangement generated successfully!', 'success');
        }

        function arrangeSeats() {
            const roomGrid = document.getElementById('room-grid');
            if (!roomGrid.children.length) {
                showNotification('Please generate seating arrangement first', 'warning');
                return;
            }

            roomGrid.childNodes.forEach(roomCard => {
                const seatContainer = roomCard.querySelector('.seat-container');
                const allSeatBoxes = seatContainer.querySelectorAll('.seat-box');
                const seats = Array.from(allSeatBoxes).map(seatBox => {
                    if (seatBox.classList.contains('empty')) return { isEmpty: true };
                    return {
                        rollNo: seatBox.dataset.rollNo,
                        dept: seatBox.dataset.dept,
                        year: seatBox.dataset.year,
                        subject: seatBox.dataset.subject,
                        staff: seatBox.querySelector('.staff').textContent,
                        deptColor: seatBox.style.getPropertyValue('--dept-color'),
                        yearColor: seatBox.style.getPropertyValue('--year-color')
                    };
                });

                const occupiedSeats = seats.filter(seat => !seat.isEmpty);

                const groupByDeptYear = {};
                occupiedSeats.forEach(seat => {
                    const key = `${seat.dept}-${seat.year}`;
                    if (!groupByDeptYear[key]) groupByDeptYear[key] = [];
                    groupByDeptYear[key].push(seat);
                });

                const groupKeys = Object.keys(groupByDeptYear);
                if (groupKeys.length <= 1) {
                    showNotification('No rearrangement needed for single department-year group', 'warning');
                    return;
                }

                const roomNo = roomCard.querySelector('.room-title').textContent.replace('Room ', '').trim();
                const roomMatrix = getRoomMatrix(roomNo);
                const totalRows = roomMatrix.rows;
                const totalColumns = roomMatrix.columns;

                // Calculate how many seats each column has
                const colSizes = [];
                for (let col = 0; col < totalColumns; col++) {
                    let count = 0;
                    for (let row = 0; row < totalRows; row++) {
                        if (roomMatrix.hasCustomRowConfig) {
                            const seatsInRow = roomMatrix.rowSeats[row] || totalColumns;
                            if (col < seatsInRow) count++;
                        } else {
                            count++;
                        }
                    }
                    colSizes.push(count);
                }

                // Clone group queues
                const groupQueues = {};
                groupKeys.forEach(k => { groupQueues[k] = [...groupByDeptYear[k]]; });

                // CORE LOGIC:
                // Assign one group per column in strict rotation (col 0→group0, col 1→group1, col 2→group2, col 3→group0, ...)
                // For each column, fill ALL slots from that group.
                // If that group is exhausted, take remaining slots from other groups (in rotation order)
                // BUT skip to the next available group that hasn't been used in adjacent columns.
                // This ensures no two adjacent columns ever have the same department.

                // Build column-to-group assignments first (which group STARTS each column)
                const colGroupAssignment = []; // colGroupAssignment[col] = groupKey
                const numGroups = groupKeys.length;
                for (let col = 0; col < totalColumns; col++) {
                    colGroupAssignment.push(groupKeys[col % numGroups]);
                }

                // Now fill seats column by column strictly following the assignment
                // seatGrid[row][col] = seat or null
                const seatGrid = Array.from({ length: totalRows }, () => Array(totalColumns).fill(null));

                // We need to distribute seats such that:
                // - Each column is filled primarily with its assigned group
                // - Overflow seats from exhausted groups go to the SAME column (not spilling into adjacent)
                // - But we must ensure all students are placed

                // Better approach: pre-calculate how many seats each group needs per column
                // Strategy: round-robin fill - go through columns repeatedly, 
                // each pass place one seat from the assigned group into the column
                // This guarantees strict alternation

                // Build per-column seat lists in strict alternating order
                const colSeats = Array.from({ length: totalColumns }, () => []);

                // Pass 1: Fill each column with its primary group seats, one-by-one in round-robin
                // This ensures even distribution
                let hasMore = true;
                while (hasMore) {
                    hasMore = false;
                    for (let col = 0; col < totalColumns; col++) {
                        const primaryGroup = colGroupAssignment[col];
                        if (groupQueues[primaryGroup] && groupQueues[primaryGroup].length > 0) {
                            if (colSeats[col].length < colSizes[col]) {
                                colSeats[col].push(groupQueues[primaryGroup].shift());
                                hasMore = true;
                            }
                        }
                    }
                }

                // Pass 2: Place any remaining students (overflow) into columns that still have empty slots
                // Place overflow in columns where the adjacent columns don't have the same dept
                // To maintain separation, place overflow students at the END of columns 
                // (bottom rows) in columns assigned to their group index offset by numGroups
                const remainingGroups = groupKeys.filter(k => groupQueues[k].length > 0);
                
                if (remainingGroups.length > 0) {
                    // Find columns with available slots, sorted by their group assignment
                    // to minimize adjacency conflicts
                    for (const key of remainingGroups) {
                        while (groupQueues[key].length > 0) {
                            // Find best column: prefer column assigned to same group (already has same dept)
                            // then prefer columns not adjacent to same-dept column
                            let bestCol = -1;
                            
                            // First try: find a column already containing this group's students 
                            // that still has space (extending existing group column is better than 
                            // creating a new adjacent same-dept column)
                            for (let col = 0; col < totalColumns; col++) {
                                if (colSeats[col].length < colSizes[col]) {
                                    const hasSameDept = colSeats[col].some(s => `${s.dept}-${s.year}` === key);
                                    if (hasSameDept) { bestCol = col; break; }
                                }
                            }
                            
                            // Second try: find any column with space where neighbors differ
                            if (bestCol === -1) {
                                for (let col = 0; col < totalColumns; col++) {
                                    if (colSeats[col].length < colSizes[col]) {
                                        const leftKey = col > 0 && colSeats[col-1].length > 0 
                                            ? `${colSeats[col-1][0].dept}-${colSeats[col-1][0].year}` : '';
                                        const rightKey = col < totalColumns-1 && colSeats[col+1].length > 0 
                                            ? `${colSeats[col+1][0].dept}-${colSeats[col+1][0].year}` : '';
                                        if (leftKey !== key && rightKey !== key) { bestCol = col; break; }
                                    }
                                }
                            }
                            
                            // Last resort: any column with space
                            if (bestCol === -1) {
                                for (let col = 0; col < totalColumns; col++) {
                                    if (colSeats[col].length < colSizes[col]) { bestCol = col; break; }
                                }
                            }
                            
                            if (bestCol === -1) break; // no space left
                            colSeats[bestCol].push(groupQueues[key].shift());
                        }
                    }
                }

                // Place colSeats into seatGrid (column-major: col 0 top-to-bottom, then col 1, etc.)
                for (let col = 0; col < totalColumns; col++) {
                    let seatIdx = 0;
                    for (let row = 0; row < totalRows; row++) {
                        if (roomMatrix.hasCustomRowConfig) {
                            const seatsInRow = roomMatrix.rowSeats[row] || totalColumns;
                            if (col >= seatsInRow) continue;
                        }
                        if (seatIdx < colSeats[col].length) {
                            seatGrid[row][col] = colSeats[col][seatIdx++];
                        }
                    }
                }

                // Re-render seat container
                seatContainer.innerHTML = '';

                if (roomMatrix.hasCustomRowConfig) {
                    seatContainer.style.display = 'flex';
                    seatContainer.style.flexDirection = 'column';
                    seatContainer.style.gap = '8px';
                    for (let row = 0; row < totalRows; row++) {
                        const rowDiv = document.createElement('div');
                        rowDiv.style.cssText = 'display:flex;gap:8px;justify-content:center';
                        const seatsInRow = roomMatrix.rowSeats[row] || totalColumns;
                        for (let col = 0; col < seatsInRow; col++) {
                            rowDiv.appendChild(createSeatBox(seatGrid[row][col] || { isEmpty: true }));
                        }
                        seatContainer.appendChild(rowDiv);
                    }
                } else {
                    seatContainer.style.gridTemplateColumns = `repeat(${totalColumns}, 45px)`;
                    seatContainer.style.justifyContent = 'center';
                    for (let row = 0; row < totalRows; row++) {
                        for (let col = 0; col < totalColumns; col++) {
                            seatContainer.appendChild(createSeatBox(seatGrid[row][col] || { isEmpty: true }));
                        }
                    }
                }
            });

            showNotification('Seats arranged — departments alternated across columns!', 'success');
        }

        function clearAllData() {
            const roomGrid = document.getElementById('room-grid');
            const inputBody = document.getElementById('input-body');
            if (!roomGrid.children.length && inputBody.children.length === 1) { showNotification('Nothing to clear', 'warning'); return; }
            if (confirm('Are you sure you want to clear everything?')) {
                roomGrid.innerHTML = '';
                inputBody.innerHTML = '';
                document.getElementById('exam-unit').value = '';
                document.getElementById('exam-date').value = '';
                document.getElementById('exam-time').value = '';
                updateExamInfoDisplay();
                loadDefaultRow();
                toggleNoData();
                attachDeleteListeners();
                showNotification('All data cleared', 'success');
            }
        }

        function saveArrangement() {
            const examUnit = document.getElementById('exam-unit');
            const examDate = document.getElementById('exam-date');
            const examTime = document.getElementById('exam-time');
            if (!examUnit.value || !examDate.value || !examTime.value) { showNotification('Please select exam unit, date and time before saving', 'warning'); return; }
            const inputData = Array.from(document.getElementById('input-body').querySelectorAll('tr')).map(row => ({
                roomNo: row.querySelector('input').value,
                departments: Array.from(row.querySelectorAll('.dept-entry')).map(entry => ({
                    dept: entry.querySelector('.dept-select').value,
                    year: entry.querySelector('.year-select').value,
                    subject: entry.querySelector('.subject-input').value,
                    rollRange: entry.querySelector('.roll-range').value
                })),
                staff: row.querySelector('textarea').value
            }));
            const generatedData = Array.from(document.getElementById('room-grid').children).map(room => ({
                title: room.querySelector('.room-title').textContent,
                seats: Array.from(room.querySelectorAll('.seat-box')).map(box => {
                    if (box.classList.contains('empty')) return { isEmpty: true };
                    return {
                        rollNo: box.dataset.rollNo, dept: box.dataset.dept || '', year: box.dataset.year || '',
                        subject: box.dataset.subject || '', staff: box.querySelector('.staff').textContent,
                        deptColor: box.style.getPropertyValue('--dept-color'), yearColor: box.style.getPropertyValue('--year-color')
                    };
                })
            }));
            if (!inputData.length && !generatedData.length) { showNotification('Nothing to save', 'warning'); return; }
            const savedArrangements = JSON.parse(localStorage.getItem('savedArrangements') || '[]');
            const unitDateTimeKey = `${examUnit.value}_${examDate.value}_${examTime.value}`;
            const existingIndex = savedArrangements.findIndex(arr => arr.unitDateTimeKey === unitDateTimeKey);
            if (existingIndex !== -1) {
                savedArrangements[existingIndex] = { unitDateTimeKey, unit: examUnit.value, date: examDate.value, time: examTime.value, inputData, generatedData };
                showNotification('Arrangement updated successfully!', 'success');
            } else {
                savedArrangements.push({ unitDateTimeKey, unit: examUnit.value, date: examDate.value, time: examTime.value, inputData, generatedData });
                showNotification('Arrangement saved successfully!', 'success');
            }
            localStorage.setItem('savedArrangements', JSON.stringify(savedArrangements));
            loadSavedArrangements();
            loadUnitButtons();
            switchSection('saved');
        }

        function handleExcelUpload() {
            const file = document.getElementById('excel-upload').files[0];
            if (!file) { showNotification('Please select an Excel file', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                jsonData.forEach(row => {
                    const departments = row['Departments, Years & Subjects']
                        ? row['Departments, Years & Subjects'].split(';').map(entry => { const [dept, year, subject, rollRange] = entry.split('|'); return { dept, year, subject, rollRange }; })
                        : [];
                    document.getElementById('input-body').appendChild(createInputRow({ roomNo: row['Room No'], departments, staff: row['Staff Names'] }));
                });
                attachDeleteListeners();
                showNotification('Excel data uploaded and appended successfully', 'success');
                document.getElementById('excel-upload').value = '';
            };
            reader.readAsArrayBuffer(file);
        }

        document.addEventListener('DOMContentLoaded', initialize);
