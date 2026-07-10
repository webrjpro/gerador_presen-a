// === CONFIGURAÇÃO DE PERFIS ===
const DEFAULT_USER_ROLE = 'rh';
const ROLE_PERMISSIONS = Object.freeze({
    admin: ['import', 'template', 'generate', 'context', 'vacation', 'holiday', 'reports', 'portal', 'reset', 'exportStudents', 'hr'],
    rh: ['import', 'template', 'generate', 'context', 'vacation', 'holiday', 'reports', 'portal', 'reset', 'exportStudents', 'hr'],
    coord: ['import', 'template', 'generate', 'context', 'vacation', 'holiday', 'reports', 'portal', 'exportStudents', 'hr'],
    professor: ['reports'],
    financeiro: ['reports', 'exportStudents']
});

function normalizeRole(role) {
    return ROLE_PERMISSIONS[role] ? role : DEFAULT_USER_ROLE;
}

// === ESTADO GLOBAL ===
let currentDate = new Date();
let employees = [];
let schedule = {};
let attendance = {};
let holidays = {};
let isScheduleGenerated = false;
let globalHODays = 2;
let vacations = {};
let currentMode = 'schedule';
let context = { local: '', unidade: '', sala: '', calendar: [] };
let selectedDays = [];
let dayMetadata = {};
let currentAttKey = null;
let attendanceChart = null;
let currentDayDetailKey = null;
let students = [];
let userRole = DEFAULT_USER_ROLE;
let themeMode = 'dark';
let importState = null;
let exportFilteredStudents = [];
let nationalHolidayCache = {};
let hr = {
    licenses: [],
    timebank: [],
    timeclock: [],
    documents: [],
    positions: [],
    evaluations: [],
    trainings: [],
    legalReports: []
};

const STUDENT_FIELDS = [
    "Dados Pessoais",
    "ID do Aluno",
    "Nome Completo",
    "Nome Social",
    "CPF",
    "RG",
    "Data de Nascimento",
    "Idade",
    "Sexo",
    "Estado Civil",
    "Nacionalidade",
    "📍 Contato e Endereço",
    "E-mail",
    "Telefone",
    "WhatsApp",
    "Nome do Responsável",
    "Telefone do Responsável",
    "Endereço",
    "Bairro",
    "Cidade",
    "Estado",
    "CEP",
    "🏫 Dados Acadêmicos",
    "Matrícula",
    "Curso",
    "Turma",
    "Série / Período",
    "Turno",
    "Modalidade (Presencial / EAD / Híbrido)",
    "Data de Matrícula",
    "Situação do Aluno (Ativo / Trancado / Concluído)",
    "Ano Letivo",
    "Semestre",
    "📚 Desempenho Escolar",
    "Disciplina",
    "Professor",
    "Nota 1",
    "Nota 2",
    "Nota 3",
    "Média Final",
    "Frequência (%)",
    "Total de Faltas",
    "Situação Final (Aprovado / Reprovado)",
    "Recuperação",
    "📝 Controle e Observações",
    "Data da Última Avaliação",
    "Data da Última Atualização",
    "Observações",
    "Advertências",
    "Ocorrências",
    "Necessidades Especiais",
    "Bolsa / Desconto",
    "Valor da Mensalidade",
    "Status Financeiro",
    "Assinatura / Responsável"
];

const hoPairs = [[0, 2], [1, 3], [2, 4], [3, 0], [4, 1], [0, 3], [1, 4]];

// === PERSISTÊNCIA ===
function saveData() {
    const data = { employees, schedule, isScheduleGenerated, globalHODays, vacations, attendance, holidays, context, selectedDays, currentMode, dayMetadata, students, userRole, themeMode, hr };
    localStorage.setItem('matrix_pro_premium_data', JSON.stringify(data));
    updateDashboard();
}

function loadData() {
    const saved = localStorage.getItem('matrix_pro_premium_data');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if(p.employees) employees = p.employees;
            if(p.schedule) schedule = p.schedule;
            if(p.attendance) attendance = p.attendance;
            if(p.holidays) holidays = p.holidays;
            if(p.isScheduleGenerated !== undefined) isScheduleGenerated = p.isScheduleGenerated;
            if(p.globalHODays) globalHODays = p.globalHODays;
            if(p.vacations) vacations = p.vacations;
            if(p.currentMode) currentMode = p.currentMode;
            if(p.context) context = p.context;
            if(p.selectedDays) selectedDays = p.selectedDays;
            if(p.dayMetadata) dayMetadata = p.dayMetadata;
            if(p.students) students = p.students;
            if(p.userRole) userRole = normalizeRole(p.userRole);
            if(p.themeMode) themeMode = p.themeMode;
            if(p.hr) hr = p.hr;

            // Normalizar IDs de funcionários para Number (consistência interna)
            employees = employees.map(e => ({ ...e, id: Number(e.id) }));
            // Normalizar empId em estruturas de RH (se existirem)
            if (hr) {
                const lists = ['licenses','timebank','timeclock','documents','positions','evaluations','trainings'];
                lists.forEach(listName => {
                    if (Array.isArray(hr[listName])) {
                        hr[listName] = hr[listName].map(item => ({ ...item, empId: item.empId !== undefined ? Number(item.empId) : item.empId }));
                    }
                });
            }
            setSystemMode(currentMode, false);
            document.getElementById('global-ho-days').value = globalHODays;
        } catch(e) { console.error("Erro ao carregar dados", e); }
    }
}

// === TOOLTIPS REFINADOS ===
function initTooltips() {
    const tooltip = document.getElementById('custom-tooltip');
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', e => {
            const text = el.getAttribute('data-tooltip');
            if(!text) return;
            tooltip.textContent = text;
            tooltip.classList.add('visible');
            positionTooltip(e, tooltip);
        });
        el.addEventListener('mousemove', e => positionTooltip(e, tooltip));
        el.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}

function normalizeKey(key) {
    return key
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function parseNumeric(value) {
    if(value === null || value === undefined) return null;
    const cleaned = value.toString().replace(',', '.').replace(/[^0-9.]/g, '');
    if(!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function parseDate(value) {
    if(!value) return null;
    if(value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
    const str = value.toString().trim();
    if(!str) return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(br) return `${br[3]}-${br[2]}-${br[1]}`;
    return null;
}

function buildAutoMapping(headers) {
    const headerMap = {};
    headers.forEach(h => { headerMap[normalizeKey(h)] = h; });
    const mapping = {};
    STUDENT_FIELDS.forEach(field => {
        const normalized = normalizeKey(field);
        if (headerMap[normalized]) { mapping[field] = headerMap[normalized]; return; }
        const fallback = headers.find(h => normalizeKey(h).includes(normalized));
        mapping[field] = fallback || '';
    });
    return mapping;
}

function renderImportMappingModal(headers, rows) {
    const headerList = document.getElementById('import-headers-list');
    const mappingList = document.getElementById('import-mapping-list');
    const nameSelect = document.getElementById('map-name-select');
    const idSelect = document.getElementById('map-id-select');
    const previewBody = document.getElementById('import-preview-body');

    headerList.innerHTML = '';
    headers.forEach(h => {
        const chip = document.createElement('span');
        chip.className = 'px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold';
        chip.textContent = h;
        headerList.appendChild(chip);
    });

    const mapping = buildAutoMapping(headers);
    importState = { headers, rows, mapping };

    mappingList.innerHTML = '';
    const highlightFields = [
        'Nome Completo',
        'ID do Aluno',
        'Curso',
        'Turma',
        'Situação do Aluno (Ativo / Trancado / Concluído)',
        'Status Financeiro'
    ];
    highlightFields.forEach(field => {
        const value = mapping[field] || 'Não identificado';
        mappingList.innerHTML += `<div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs"><span class="font-bold text-slate-600">${field}</span><span class="text-slate-500">${value}</span></div>`;
    });

    const options = [''].concat(headers);
    nameSelect.innerHTML = options.map(h => `<option value="${h}">${h || 'Selecionar...'}</option>`).join('');
    idSelect.innerHTML = options.map(h => `<option value="${h}">${h || 'Selecionar...'}</option>`).join('');
    nameSelect.value = mapping['Nome Completo'] || '';
    idSelect.value = mapping['ID do Aluno'] || '';

    const previewRows = rows.slice(0, 5);
    previewBody.innerHTML = '';
    previewRows.forEach(row => {
        const name = row[mapping['Nome Completo']] || row[mapping['Nome Social']] || '';
        const id = row[mapping['ID do Aluno']] || row[mapping['Matrícula']] || '';
        const curso = row[mapping['Curso']] || '';
        const situacao = row[mapping['Situação do Aluno (Ativo / Trancado / Concluído)']] || '';
        previewBody.innerHTML += `<tr class="border-t"><td class="p-3 text-slate-600">${name}</td><td class="p-3 text-slate-500">${id}</td><td class="p-3 text-slate-500">${curso}</td><td class="p-3 text-slate-500">${situacao}</td></tr>`;
    });

    openModal('import-mapping-modal');
    lucide.createIcons();
}

function validateStudent(student) {
    const errors = [];
    const cpf = (student['CPF'] || '').toString().replace(/\D/g, '');
    if(cpf && cpf.length !== 11) errors.push('CPF');

    const phones = ['Telefone', 'WhatsApp', 'Telefone do Responsável'];
    phones.forEach(field => {
        const digits = (student[field] || '').toString().replace(/\D/g, '');
        if(digits && (digits.length < 10 || digits.length > 11)) errors.push(field);
    });

    const dateFields = ['Data de Nascimento','Data de Matrícula','Data da Última Avaliação','Data da Última Atualização'];
    dateFields.forEach(field => {
        const normalized = parseDate(student[field]);
        if(student[field] && !normalized) errors.push(field);
        if(normalized) student[field] = normalized;
    });

    return errors;
}

function applyImportMapping() {
    if(!importState) return;
    const nameSelect = document.getElementById('map-name-select').value;
    const idSelect = document.getElementById('map-id-select').value;

    if(nameSelect) importState.mapping['Nome Completo'] = nameSelect;
    if(idSelect) importState.mapping['ID do Aluno'] = idSelect;

    if(!importState.mapping['Nome Completo']) {
        return showToast('Selecione a coluna de Nome Completo.', 'error');
    }

    let invalidCount = 0;
    const mappedStudents = importState.rows.map((row, idx) => {
        const student = {};
        STUDENT_FIELDS.forEach(field => {
            const col = importState.mapping[field];
            student[field] = col ? row[col] : '';
        });
        const errors = validateStudent(student);
        if(errors.length) invalidCount++;
        student._id = student['ID do Aluno'] || student['Matrícula'] || `ALUNO-${Date.now()}-${idx}`;
        student._name = (student['Nome Completo'] || student['Nome Social'] || '').toString().trim();
        student._empId = Date.now() + idx;
        return student;
    });

    students = mappedStudents.filter(s => s._name);
    employees = students.map(s => ({ id: s._empId, name: s._name }));

    saveData(); renderUI();
    closeModal('import-mapping-modal');
    showToast(`${students.length} alunos importados${invalidCount ? `, ${invalidCount} com dados inválidos` : ''}.`);
    setTimeout(handleGenerateTrigger, 500);
}

function applyRolePermissions() {
    const allowed = ROLE_PERMISSIONS[normalizeRole(userRole)];
    document.querySelectorAll('[data-permission]').forEach(el => {
        const key = el.getAttribute('data-permission');
        const enable = allowed.includes(key);
        if (el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.tagName === 'INPUT') {
            el.disabled = !enable;
        }
        el.classList.toggle('opacity-50', !enable);
        el.classList.toggle('pointer-events-none', !enable);
    });
}

function setRole(role) {
    userRole = normalizeRole(role);
    saveData();
    applyRolePermissions();
}

function applyTheme() {
    document.body.classList.toggle('dark', themeMode === 'dark');
    const icon = document.getElementById('theme-icon');
    if(icon) icon.setAttribute('data-lucide', themeMode === 'dark' ? 'sun' : 'moon');
    lucide.createIcons();
}

function toggleTheme() {
    themeMode = themeMode === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveData();
}

function openExportStudentsModal() {
    applyExportFilters();
    openModal('export-students-modal');
    lucide.createIcons();
}

function applyExportFilters() {
    const search = (document.getElementById('export-search').value || '').toLowerCase();
    const curso = (document.getElementById('export-curso').value || '').toLowerCase();
    const turma = (document.getElementById('export-turma').value || '').toLowerCase();
    const situacao = (document.getElementById('export-situacao').value || '').toLowerCase();
    const financeiro = (document.getElementById('export-financeiro').value || '').toLowerCase();

    exportFilteredStudents = students.filter(s => {
        const haystack = `${s._name} ${s['ID do Aluno']} ${s['CPF']} ${s['Matrícula']}`.toLowerCase();
        if(search && !haystack.includes(search)) return false;
        if(curso && !(s['Curso'] || '').toLowerCase().includes(curso)) return false;
        if(turma && !(s['Turma'] || '').toLowerCase().includes(turma)) return false;
        if(situacao && !(s['Situação do Aluno (Ativo / Trancado / Concluído)'] || '').toLowerCase().includes(situacao)) return false;
        if(financeiro && !(s['Status Financeiro'] || '').toLowerCase().includes(financeiro)) return false;
        return true;
    });

    document.getElementById('export-count').innerText = exportFilteredStudents.length;
}

function exportStudentsToExcel() {
    if(!students.length) return showToast('Nenhum aluno importado.', 'error');
    if(!exportFilteredStudents.length) applyExportFilters();

    const rows = exportFilteredStudents.map(s => {
        const row = {};
        STUDENT_FIELDS.forEach(field => { row[field] = s[field] || ''; });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, 'Alunos.xlsx');
    showToast('Exportação concluída!');
}

function getEmployeeOptions() {
    return employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

function openLicensesModal() {
    document.getElementById('license-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderLicenses();
    openModal('licenses-modal');
}

function addLicense() {
    const empId = Number(document.getElementById('license-emp-select').value);
    const type = document.getElementById('license-type').value.trim();
    const start = document.getElementById('license-start').value;
    const end = document.getElementById('license-end').value;
    if(!empId || !type || !start) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.licenses.push({ id: Date.now(), empId, type, start, end, notes: document.getElementById('license-notes').value.trim() });
    saveData(); renderLicenses();
}

function renderLicenses() {
    const list = document.getElementById('licenses-list');
    list.innerHTML = '';
    hr.licenses.forEach(l => {
        const emp = employees.find(e => e.id == l.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${l.type}</div><div style="color:#64748b;">${l.start}${l.end ? ' até ' + l.end : ''}</div><div style="color:#94a3b8;">${l.notes || ''}</div></div>`;
    });
    lucide.createIcons();
}

function openTimebankModal() {
    document.getElementById('timebank-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderTimebank();
    openModal('timebank-modal');
}

function addTimebank() {
    const empId = Number(document.getElementById('timebank-emp-select').value);
    const date = document.getElementById('timebank-date').value;
    const hours = document.getElementById('timebank-hours').value;
    if(!empId || !date || !hours) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.timebank.push({ id: Date.now(), empId, date, hours, desc: document.getElementById('timebank-desc').value.trim() });
    saveData(); renderTimebank();
}

function renderTimebank() {
    const list = document.getElementById('timebank-list');
    list.innerHTML = '';
    hr.timebank.forEach(t => {
        const emp = employees.find(e => e.id == t.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${t.hours}h</div><div style="color:#64748b;">${t.date}</div><div style="color:#94a3b8;">${t.desc || ''}</div></div>`;
    });
    lucide.createIcons();
}

function openTimeclockModal() {
    document.getElementById('timeclock-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderTimeclock();
    openModal('timeclock-modal');
}

function addTimeclock() {
    const empId = Number(document.getElementById('timeclock-emp-select').value);
    const date = document.getElementById('timeclock-date').value;
    if(!empId || !date) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.timeclock.push({ id: Date.now(), empId, date, timeIn: document.getElementById('timeclock-in').value, timeOut: document.getElementById('timeclock-out').value, notes: document.getElementById('timeclock-notes').value.trim() });
    saveData(); renderTimeclock();
}

function renderTimeclock() {
    const list = document.getElementById('timeclock-list');
    list.innerHTML = '';
    hr.timeclock.forEach(t => {
        const emp = employees.find(e => e.id == t.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${t.date}</div><div style="color:#64748b;">${t.timeIn || '-'} → ${t.timeOut || '-'}</div><div style="color:#94a3b8;">${t.notes || ''}</div></div>`;
    });
    lucide.createIcons();
}

function openDocumentsModal() {
    document.getElementById('documents-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderDocuments();
    openModal('documents-modal');
}

function addDocument() {
    const empId = Number(document.getElementById('documents-emp-select').value);
    const type = document.getElementById('documents-type').value.trim();
    if(!empId || !type) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.documents.push({ id: Date.now(), empId, type, number: document.getElementById('documents-number').value.trim(), exp: document.getElementById('documents-exp').value, status: document.getElementById('documents-status').value.trim(), notes: document.getElementById('documents-notes').value.trim() });
    saveData(); renderDocuments();
}

function renderDocuments() {
    const list = document.getElementById('documents-list');
    list.innerHTML = '';
    hr.documents.forEach(d => {
        const emp = employees.find(e => e.id == d.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${d.type}</div><div style="color:#64748b;">${d.number || ''} ${d.exp ? '• validade ' + d.exp : ''}</div><div style="color:#94a3b8;">${d.status || ''} ${d.notes ? '• ' + d.notes : ''}</div></div>`;
    });
    lucide.createIcons();
}

function openPositionsModal() {
    document.getElementById('positions-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderPositions();
    openModal('positions-modal');
}

function addPosition() {
    const empId = Number(document.getElementById('positions-emp-select').value);
    const role = document.getElementById('positions-role').value.trim();
    const unit = document.getElementById('positions-unit').value.trim();
    if(!empId || !role) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.positions.push({ id: Date.now(), empId, role, unit, start: document.getElementById('positions-start').value, end: document.getElementById('positions-end').value });
    saveData(); renderPositions();
}

function renderPositions() {
    const list = document.getElementById('positions-list');
    list.innerHTML = '';
    hr.positions.forEach(p => {
        const emp = employees.find(e => e.id == p.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${p.role}</div><div style="color:#64748b;">${p.unit || ''}</div><div style="color:#94a3b8;">${p.start || '-'} ${p.end ? 'até ' + p.end : ''}</div></div>`;
    });
    lucide.createIcons();
}

function openEvaluationsModal() {
    document.getElementById('evaluations-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderEvaluations();
    openModal('evaluations-modal');
}

function addEvaluation() {
    const empId = Number(document.getElementById('evaluations-emp-select').value);
    const period = document.getElementById('evaluations-period').value.trim();
    if(!empId || !period) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.evaluations.push({ id: Date.now(), empId, period, score: document.getElementById('evaluations-score').value, notes: document.getElementById('evaluations-notes').value.trim() });
    saveData(); renderEvaluations();
}

function renderEvaluations() {
    const list = document.getElementById('evaluations-list');
    list.innerHTML = '';
    hr.evaluations.forEach(e => {
        const emp = employees.find(x => x.id == e.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${e.period}</div><div style="color:#64748b;">Nota: ${e.score || '-'}</div><div style="color:#94a3b8;">${e.notes || ''}</div></div>`;
    });
    lucide.createIcons();
}

function openTrainingsModal() {
    document.getElementById('trainings-emp-select').innerHTML = '<option value="">Selecione...</option>' + getEmployeeOptions();
    renderTrainings();
    openModal('trainings-modal');
}

function addTraining() {
    const empId = Number(document.getElementById('trainings-emp-select').value);
    const course = document.getElementById('trainings-course').value.trim();
    if(!empId || !course) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.trainings.push({ id: Date.now(), empId, course, hours: document.getElementById('trainings-hours').value, date: document.getElementById('trainings-date').value, status: document.getElementById('trainings-status').value.trim() });
    saveData(); renderTrainings();
}

function renderTrainings() {
    const list = document.getElementById('trainings-list');
    list.innerHTML = '';
    hr.trainings.forEach(t => {
        const emp = employees.find(x => x.id == t.empId);
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${emp?.name || '-'} • ${t.course}</div><div style="color:#64748b;">${t.date || ''} • ${t.hours ? t.hours + 'h' : ''}</div><div style="color:#94a3b8;">${t.status || ''}</div></div>`;
    });
    lucide.createIcons();
}

function openLegalReportsModal() {
    renderLegalReports();
    openModal('legal-reports-modal');
}

function addLegalReport() {
    const type = document.getElementById('legal-report-type').value.trim();
    const period = document.getElementById('legal-report-period').value.trim();
    if(!type || !period) return showToast('Preencha os campos obrigatórios.', 'error');
    hr.legalReports.push({ id: Date.now(), type, period, notes: document.getElementById('legal-report-notes').value.trim(), createdAt: new Date().toLocaleString('pt-BR') });
    saveData(); renderLegalReports();
}

function renderLegalReports() {
    const list = document.getElementById('legal-reports-list');
    list.innerHTML = '';
    hr.legalReports.forEach(r => {
        list.innerHTML += `<div class="p-4 rounded-2xl mb-2 text-xs shadow-sm" style="background:#fff; border:1px solid #e2e8f0;"><div class="font-bold" style="color:#334155;">${r.type} • ${r.period}</div><div style="color:#64748b;">${r.createdAt}</div><div style="color:#94a3b8;">${r.notes || ''}</div></div>`;
    });
    lucide.createIcons();
}

// === IMPRESSÃO DE RELATÓRIOS RH ===
function printHRReport(type) {
    const titles = {
        licenses: 'Relatório de Licenças e Afastamentos',
        timebank: 'Relatório de Banco de Horas',
        timeclock: 'Relatório de Ponto Eletrônico',
        documents: 'Relatório de Documentos',
        positions: 'Relatório de Cargos e Lotações',
        evaluations: 'Relatório de Avaliações',
        trainings: 'Relatório de Capacitações'
    };

    const headers = {
        licenses: ['Colaborador', 'Tipo', 'Data Início', 'Data Fim', 'Observações'],
        timebank: ['Colaborador', 'Data', 'Horas', 'Motivo'],
        timeclock: ['Colaborador', 'Data', 'Entrada', 'Saída', 'Observações'],
        documents: ['Colaborador', 'Tipo', 'Número', 'Validade', 'Status', 'Observações'],
        positions: ['Colaborador', 'Cargo', 'Lotação', 'Início', 'Fim'],
        evaluations: ['Colaborador', 'Período', 'Nota', 'Feedback'],
        trainings: ['Colaborador', 'Curso', 'Carga Horária', 'Data', 'Status']
    };

    let rows = [];

    switch(type) {
        case 'licenses':
            rows = hr.licenses.map(l => {
                const emp = employees.find(e => e.id == l.empId);
                return [emp?.name || '-', l.type, l.start || '-', l.end || '-', l.notes || '-'];
            });
            break;
        case 'timebank':
            rows = hr.timebank.map(t => {
                const emp = employees.find(e => e.id == t.empId);
                return [emp?.name || '-', t.date, t.hours + 'h', t.desc || '-'];
            });
            break;
        case 'timeclock':
            rows = hr.timeclock.map(t => {
                const emp = employees.find(e => e.id == t.empId);
                return [emp?.name || '-', t.date, t.timeIn || '-', t.timeOut || '-', t.notes || '-'];
            });
            break;
        case 'documents':
            rows = hr.documents.map(d => {
                const emp = employees.find(e => e.id == d.empId);
                return [emp?.name || '-', d.type, d.number || '-', d.exp || '-', d.status || '-', d.notes || '-'];
            });
            break;
        case 'positions':
            rows = hr.positions.map(p => {
                const emp = employees.find(e => e.id == p.empId);
                return [emp?.name || '-', p.role, p.unit || '-', p.start || '-', p.end || '-'];
            });
            break;
        case 'evaluations':
            rows = hr.evaluations.map(e => {
                const emp = employees.find(x => x.id == e.empId);
                return [emp?.name || '-', e.period, e.score || '-', e.notes || '-'];
            });
            break;
        case 'trainings':
            rows = hr.trainings.map(t => {
                const emp = employees.find(e => e.id == t.empId);
                return [emp?.name || '-', t.course, t.hours ? t.hours + 'h' : '-', t.date || '-', t.status || '-'];
            });
            break;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${titles[type]}</title>
            <style>
                * { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
                body { padding: 20px; background: white; color: #000; }
                .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #000; }
                .header p { font-size: 12px; color: #333; margin-top: 5px; }
                .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; }
                .info span { color: #000; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th, td { border: 1px solid #000; padding: 8px 10px; text-align: left; color: #000; }
                th { background-color: #e2e8f0; font-weight: 700; text-transform: uppercase; font-size: 10px; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .footer { margin-top: 40px; display: flex; justify-content: space-around; }
                .signature { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 10px; color: #000; }
                .empty { text-align: center; padding: 30px; color: #666; font-style: italic; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${titles[type]}</h1>
                <p>${context.local || 'Matrix Pro'} ${context.unidade ? '• ' + context.unidade : ''}</p>
            </div>
            <div class="info">
                <span><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</span>
                <span><strong>Total de Registros:</strong> ${rows.length}</span>
            </div>
            ${rows.length > 0 ? `
                <table>
                    <thead>
                        <tr>${headers[type].map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            ` : `<div class="empty">Nenhum registro encontrado.</div>`}
            <div class="footer">
                <div class="signature">Gestor Responsável</div>
                <div class="signature">Recursos Humanos</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
}

function positionTooltip(e, tooltip) {
    const x = e.clientX;
    const y = e.clientY;
    const offset = 15;
    let left = x + offset;
    let top = y + offset;
    if (left + tooltip.offsetWidth > window.innerWidth) {
        left = x - tooltip.offsetWidth - offset;
    }
    if (top + tooltip.offsetHeight > window.innerHeight) {
        top = y - tooltip.offsetHeight - offset;
    }
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// === DASHBOARD E BUSCA ===
function updateDashboard() {
    document.getElementById('stat-team-count').innerText = employees.length;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    let todayPres = 0;
    let monthFails = 0;
    let vacCount = 0;

    employees.forEach(emp => {
        const attToday = attendance[todayKey + '-' + emp.id]?.status || 'P';
        if(['P','A','S'].includes(attToday)) todayPres++;
        if(isEmployeeOnVacation(emp.id, today)) vacCount++;
        selectedDays.forEach(d => {
            const k = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${d}`;
            if(attendance[k + '-' + emp.id]?.status === 'F') monthFails++;
        });
    });

    document.getElementById('stat-today-pres').innerText = todayPres;
    document.getElementById('stat-vac-count').innerText = vacCount;
    document.getElementById('stat-month-fails').innerText = monthFails;

    const academicKpis = document.getElementById('academic-kpis');
    if (academicKpis) academicKpis.classList.toggle('hidden', students.length === 0);

    if (students.length) {
        const total = students.length;
        const active = students.filter(s => (s['Situação do Aluno (Ativo / Trancado / Concluído)'] || '').toLowerCase().includes('ativo')).length;
        const overdue = students.filter(s => {
            const status = (s['Status Financeiro'] || '').toLowerCase();
            return status.includes('inadimpl') || status.includes('atras') || status.includes('pend');
        }).length;

        let sum = 0;
        let count = 0;
        students.forEach(s => {
            const media = parseNumeric(s['Média Final']);
            if (media !== null) { sum += media; count++; return; }
            const n1 = parseNumeric(s['Nota 1']);
            const n2 = parseNumeric(s['Nota 2']);
            const n3 = parseNumeric(s['Nota 3']);
            const arr = [n1, n2, n3].filter(v => v !== null);
            if(arr.length) { sum += arr.reduce((a,b)=>a+b,0)/arr.length; count++; }
        });

        document.getElementById('stat-students-total').innerText = total;
        document.getElementById('stat-students-active').innerText = active;
        document.getElementById('stat-finance-overdue').innerText = overdue;
        document.getElementById('stat-avg-grade').innerText = count ? (sum / count).toFixed(1) : '-';
    }

    const exportBtn = document.querySelector('[data-permission="exportStudents"]');
    if (exportBtn && !exportBtn.classList.contains('pointer-events-none')) {
        exportBtn.disabled = students.length === 0;
        exportBtn.classList.toggle('opacity-50', students.length === 0);
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const styles = {
        success: 'bg-white border-l-4 border-emerald-500 text-slate-800',
        error: 'bg-white border-l-4 border-rose-500 text-slate-800',
        info: 'bg-white border-l-4 border-indigo-500 text-slate-800'
    };
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const iconColors = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-indigo-500' };

    toast.className = `${styles[type]} px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in min-w-[300px] border border-slate-100`;
    toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-5 h-5 ${iconColors[type]}"></i><span class="text-sm font-semibold">${msg}</span>`;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

function getSidebarMenuElements() {
    return {
        sidebar: document.getElementById('app-sidebar'),
        trigger: document.getElementById('sidebar-menu-trigger')
    };
}

function closeSidebarMenu() {
    const { sidebar, trigger } = getSidebarMenuElements();
    if (!sidebar || !trigger) return;

    sidebar.classList.remove('is-open');
    sidebar.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
}

function openSidebarMenu(event) {
    event?.stopPropagation();
    const { sidebar, trigger } = getSidebarMenuElements();
    if (!sidebar || !trigger) return;

    sidebar.classList.add('is-open');
    sidebar.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');

    window.setTimeout(() => document.getElementById('new-emp-name')?.focus(), 180);
}

function toggleSidebarMenu(event) {
    event?.stopPropagation();
    const { sidebar, trigger } = getSidebarMenuElements();
    if (!sidebar || !trigger) return;

    const isOpen = sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', !isOpen);
    sidebar.setAttribute('aria-hidden', String(isOpen));
    trigger.setAttribute('aria-expanded', String(!isOpen));
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebarMenu();
});

// === FUNÇÕES DA AGENDA RÁPIDA ===
function openQuickAgendaModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quick-agenda-form').reset();
    document.getElementById('quick-event-date').value = today;
    document.getElementById('quick-event-time').value = "09:00";
    document.getElementById('quick-event-end-time').value = "10:00";
    document.getElementById('quick-event-category').value = 'trabalho';
    document.getElementById('quick-event-priority').value = 'normal';
    toggleQuickCustomCategory('trabalho');
    updateQuickDateIntel();
    renderQuickDayPreview();
    syncNationalHolidays(new Date().getFullYear()).then(() => updateQuickDateIntel()).catch(() => null);

    const modal = document.getElementById('quick-agenda-modal');
    const modalContent = document.getElementById('quick-modal-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeQuickAgendaModal() {
    const modal = document.getElementById('quick-agenda-modal');
    const modalContent = document.getElementById('quick-modal-content');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// === FUNÇÕES DO STATUS DO COLABORADOR ===
let currentEmployeeId = null;

function openEmployeeStatusModal(empId) {
    currentEmployeeId = Number(empId);
    const emp = employees.find(e => e.id === currentEmployeeId);
    if (!emp) return;

    document.getElementById('employee-status-name').innerText = emp.name;
    document.getElementById('employee-status').value = emp.status || 'ativo';
    document.getElementById('status-start-date').value = emp.statusStart || '';
    document.getElementById('status-end-date').value = emp.statusEnd || '';
    document.getElementById('status-notes').value = emp.statusNotes || '';

    toggleStatusDates(emp.status || 'ativo');

    const modal = document.getElementById('employee-status-modal');
    const modalContent = document.getElementById('employee-status-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeEmployeeStatusModal() {
    const modal = document.getElementById('employee-status-modal');
    const modalContent = document.getElementById('employee-status-content');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function toggleStatusDates(status) {
    const datesDiv = document.getElementById('status-dates');
    if (status === 'ativo') {
        datesDiv.classList.add('hidden');
    } else {
        datesDiv.classList.remove('hidden');
    }
}

function handleEmployeeStatus(event) {
    event.preventDefault();
    const emp = employees.find(e => e.id === currentEmployeeId);
    if (!emp) return;

    const status = document.getElementById('employee-status').value;
    const startDate = document.getElementById('status-start-date').value;
    const endDate = document.getElementById('status-end-date').value;
    const notes = document.getElementById('status-notes').value;

    emp.status = status;
    emp.statusStart = startDate;
    emp.statusEnd = endDate;
    emp.statusNotes = notes;

    saveData();
    renderMatrix();
    showToast(`Status salvo: ${emp.name} → ${emp.status}`, 'success');
    closeEmployeeStatusModal();
}

function undoEmployeeStatus() {
    const emp = employees.find(e => e.id === currentEmployeeId);
    if (!emp) return;

    // Volta para ativo e limpa todos os campos de status
    emp.status = 'ativo';
    emp.statusStart = '';
    emp.statusEnd = '';
    emp.statusNotes = '';

    saveData();
    renderMatrix();
    closeEmployeeStatusModal();
}

function toggleQuickCustomCategory(val) {
    const customInput = document.getElementById('quick-event-custom-category');
    if (val === 'outros') {
        customInput.classList.remove('hidden');
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
    }
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getQuickAgendaEvents() {
    try {
        return JSON.parse(localStorage.getItem('unifiedAgendaEventsHTML') || '[]');
    } catch {
        return [];
    }
}

function saveQuickAgendaEvents(events) {
    localStorage.setItem('unifiedAgendaEventsHTML', JSON.stringify(events));
}

function timeToMinutes(time) {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

function detectQuickEventConflict(event, events = getQuickAgendaEvents()) {
    const start = timeToMinutes(event.time);
    const end = timeToMinutes(event.endTime);
    if (start === null || end === null) return null;

    return events.find(existing => {
        if (existing.date !== event.date) return false;
        const existingStart = timeToMinutes(existing.time);
        const existingEnd = timeToMinutes(existing.endTime);
        if (existingStart === null || existingEnd === null) return false;
        return start < existingEnd && end > existingStart;
    }) || null;
}

function getPriorityMeta(priority) {
    const map = {
        normal: { label: 'Normal', className: 'bg-slate-100 text-slate-600 border-slate-200' },
        alta: { label: 'Alta', className: 'bg-amber-100 text-amber-700 border-amber-200' },
        critica: { label: 'Crítica', className: 'bg-rose-100 text-rose-700 border-rose-200' }
    };
    return map[priority] || map.normal;
}

function renderQuickDayPreview() {
    const preview = document.getElementById('quick-day-preview');
    const date = document.getElementById('quick-event-date')?.value;
    if (!preview || !date) return;

    const events = getQuickAgendaEvents()
        .filter(event => event.date === date)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (!events.length) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }

    preview.classList.remove('hidden');
    preview.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-500">Agenda do dia</span>
            <span class="text-[11px] font-bold text-indigo-600">${events.length} evento${events.length > 1 ? 's' : ''}</span>
        </div>
        <div class="space-y-2">
            ${events.slice(0, 4).map(event => {
                const priority = getPriorityMeta(event.priority);
                return `
                    <div class="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div class="min-w-0">
                            <div class="text-xs font-black text-slate-800 truncate">${escapeHTML(event.title)}</div>
                            <div class="text-[11px] text-slate-500">${escapeHTML(event.time || '--:--')} - ${escapeHTML(event.endTime || '--:--')}${event.location ? ` • ${escapeHTML(event.location)}` : ''}</div>
                        </div>
                        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${priority.className}">${priority.label}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function updateQuickDateIntel() {
    const panel = document.getElementById('quick-date-intel');
    const dateValue = document.getElementById('quick-event-date')?.value;
    if (!panel || !dateValue) return;

    const date = new Date(`${dateValue}T00:00:00`);
    const isWeekend = [0, 6].includes(date.getDay());
    const holidayLabel = holidays[dateValue] || (isHoliday(date) ? 'FERIADO' : '');
    const dayEvents = getQuickAgendaEvents().filter(event => event.date === dateValue).length;
    const notes = [];

    if (holidayLabel) notes.push(`Feriado: ${holidayLabel}`);
    if (isWeekend) notes.push('Fim de semana');
    if (dayEvents) notes.push(`${dayEvents} evento${dayEvents > 1 ? 's' : ''} no dia`);

    if (!notes.length) {
        panel.className = 'mt-2 hidden rounded-lg border px-3 py-2 text-xs font-semibold';
        panel.innerHTML = '';
        return;
    }

    const hasRisk = Boolean(holidayLabel || isWeekend);
    panel.className = `mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${hasRisk ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`;
    panel.textContent = notes.join(' • ');
}

function initQuickAgendaEnhancements() {
    ['quick-event-date', 'quick-event-time', 'quick-event-end-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            updateQuickDateIntel();
            renderQuickDayPreview();
        });
    });
}

function formatIcsText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function formatIcsDate(date, time) {
    return `${date.replaceAll('-', '')}T${(time || '00:00').replace(':', '')}00`;
}

function downloadQuickAgendaIcs() {
    const events = getQuickAgendaEvents().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    if (!events.length) return showToast('Nenhum evento na agenda rápida.', 'error');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MatrixPro//Agenda Rapida//PT-BR',
        'CALSCALE:GREGORIAN',
        ...events.flatMap(event => [
            'BEGIN:VEVENT',
            `UID:${event.id || Date.now()}@matrixpro.local`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
            `DTSTART:${formatIcsDate(event.date, event.time)}`,
            `DTEND:${formatIcsDate(event.date, event.endTime)}`,
            `SUMMARY:${formatIcsText(event.title)}`,
            `DESCRIPTION:${formatIcsText([event.description, event.owner ? `Responsável: ${event.owner}` : '', event.priority ? `Prioridade: ${event.priority}` : ''].filter(Boolean).join('\n'))}`,
            event.location ? `LOCATION:${formatIcsText(event.location)}` : '',
            'END:VEVENT'
        ].filter(Boolean)),
        'END:VCALENDAR'
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'agenda_matrixpro.ics';
    a.click();
    URL.revokeObjectURL(a.href);
}

async function handleQuickAddEvent(e) {
    e.preventDefault();

    const date = document.getElementById('quick-event-date').value;
    const title = document.getElementById('quick-event-title').value.toUpperCase();
    const time = document.getElementById('quick-event-time').value;
    const endTime = document.getElementById('quick-event-end-time').value;
    let category = document.getElementById('quick-event-category').value;

    // Lógica Categoria Personalizada
    if (category === 'outros') {
        const customVal = document.getElementById('quick-event-custom-category').value.trim().toUpperCase();
        if (customVal) category = customVal;
        else category = 'OUTROS';
    }

    const description = document.getElementById('quick-event-description').value.toUpperCase();
    const emailsRaw = document.getElementById('quick-event-emails').value;
    const waRaw = document.getElementById('quick-event-whatsapp').value;
    const fileInput = document.getElementById('quick-event-attachment');
    const attachmentName = fileInput.files.length > 0 ? fileInput.files[0].name : null;
    let attachmentData = null;
    const reminder = document.getElementById('quick-event-reminder').value;
    const notification = document.getElementById('quick-event-notification').checked;
    const recurrence = document.getElementById('quick-event-recurrence').value;
    const priority = document.getElementById('quick-event-priority').value;
    const location = document.getElementById('quick-event-location').value.trim();
    const owner = document.getElementById('quick-event-owner').value.trim();

    // Tratamento do Anexo
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        attachmentData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    if (!title) return;

    // Salvar contatos novos
    if (emailsRaw) {
        const list = emailsRaw.split(',').map(e => e.trim()).filter(e => e);
        for (const item of list) await saveContact(item, 'email');
    }

    let finalWa = '';
    if (waRaw) {
        const list = waRaw.split(',').map(e => e.trim()).filter(e => e);
        let formattedList = [];
        for (const item of list) {
            const fmt = formatWhatsAppNumber(item);
            if(fmt) { formattedList.push(fmt); await saveContact(fmt, 'whatsapp'); }
        }
        finalWa = formattedList.join(',');
    }

    const eventId = Date.now();

    // Se houver anexo, salvamos no IndexedDB
    if (attachmentData) {
        await saveAttachmentToDB(eventId, attachmentData);
    }

    const newEvent = {
        id: eventId,
        date: date,
        title, time, endTime, category, description,
        emails: emailsRaw,
        whatsapp: finalWa,
        attachmentName,
        reminder,
        notification,
        recurrence,
        priority,
        location,
        owner,
    };

    // Carregar eventos existentes e adicionar o novo
    let events = getQuickAgendaEvents();

    const conflict = detectQuickEventConflict(newEvent, events);
    if (conflict && !confirm(`Já existe "${conflict.title}" neste horário (${conflict.time}-${conflict.endTime}). Deseja agendar mesmo assim?`)) {
        return;
    }

    // Gerar eventos recorrentes
    if (recurrence !== 'none') {
        generateRecurringEvents(newEvent, recurrence, events);
    } else {
        events.push(newEvent);
    }

    saveQuickAgendaEvents(events);

    // Agendar notificação se habilitada
    if (notification && reminder !== 'none') {
        scheduleNotification(newEvent);
    }

    closeQuickAgendaModal();
    showToast('Evento adicionado à agenda!', 'success');
    renderQuickDayPreview();
}

function openQuickContactsModal() {
    loadQuickContacts();
    document.getElementById('quick-contacts-modal').classList.remove('hidden');
}

function closeQuickContactsModal() {
    document.getElementById('quick-contacts-modal').classList.add('hidden');
}

// Gerar Eventos Recorrentes
function generateRecurringEvents(baseEvent, recurrence, events) {
    const eventList = [];
    let currentDate = new Date(baseEvent.date);
    for (let i = 0; i < 10; i++) { // Gerar até 10 ocorrências
        const event = { ...baseEvent, id: Date.now() + i, date: currentDate.toISOString().split('T')[0] };
        eventList.push(event);
        if (recurrence === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (recurrence === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else if (recurrence === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
    events.push(...eventList);
}

// Agendar Notificação
function scheduleNotification(event) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const eventDateTime = new Date(`${event.date}T${event.time}`);
    let reminderTime;
    if (event.reminder === '1day') {
        reminderTime = new Date(eventDateTime.getTime() - 24 * 60 * 60 * 1000);
    } else if (event.reminder === '2hours') {
        reminderTime = new Date(eventDateTime.getTime() - 2 * 60 * 60 * 1000);
    } else if (event.reminder === '30min') {
        reminderTime = new Date(eventDateTime.getTime() - 30 * 60 * 1000);
    }

    if (reminderTime > new Date()) {
        setTimeout(() => {
            new Notification(`Lembrete: ${event.title}`, {
                body: `Evento às ${event.time}`,
                icon: '/favicon.ico'
            });
        }, reminderTime - new Date());
    }
}

function renderQuickContactsList(contacts) {
    const list = document.getElementById('quick-contacts-list');
    if (!contacts.length) {
        list.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">Nenhum contato salvo.</div>';
        return;
    }

    list.innerHTML = contacts.map(c => `
        <label class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input type="checkbox" value="${c.value}" data-type="${c.type}" class="quick-contact-checkbox">
            <div class="flex-1">
                <div class="font-medium text-sm">${c.name || c.value}</div>
                <div class="text-xs text-gray-500">${c.type.toUpperCase()}: ${c.value}</div>
            </div>
        </label>
    `).join('');
}

async function getQuickContacts() {
    if (!db) await initDB().catch(() => null);

    const legacyContacts = JSON.parse(localStorage.getItem('agendaContacts') || '[]');
    let storedContacts = [];

    if (db) {
        storedContacts = await new Promise((resolve) => {
            const tx = db.transaction('unified_contacts', 'readonly');
            const store = tx.objectStore('unified_contacts');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    }

    const unique = new Map();
    [...legacyContacts, ...storedContacts]
        .filter(contact => contact && contact.value && contact.deleted !== true)
        .forEach(contact => {
            const key = `${contact.type}:${contact.value}`.toLowerCase();
            unique.set(key, contact);
        });

    return Array.from(unique.values())
        .sort((a, b) => (a.name || a.value).localeCompare(b.name || b.value, 'pt-BR'));
}

async function loadQuickContacts() {
    const contacts = await getQuickContacts();
    renderQuickContactsList(contacts);
}

async function filterQuickContacts() {
    const search = document.getElementById('quick-contacts-search').value.toLowerCase();
    const type = document.getElementById('quick-contacts-type').value;
    const contacts = await getQuickContacts();

    const filtered = contacts.filter(c => {
        if (type !== 'all' && c.type !== type) return false;
        return (c.name || '').toLowerCase().includes(search) || c.value.toLowerCase().includes(search);
    });

    renderQuickContactsList(filtered);
}

function addSelectedQuickContacts() {
    const checkboxes = document.querySelectorAll('.quick-contact-checkbox:checked');
    const emails = [];
    const whatsapps = [];

    checkboxes.forEach(cb => {
        if (cb.dataset.type === 'email') emails.push(cb.value);
        else if (cb.dataset.type === 'whatsapp') whatsapps.push(cb.value);
    });

    if (emails.length) document.getElementById('quick-event-emails').value = emails.join(', ');
    if (whatsapps.length) document.getElementById('quick-event-whatsapp').value = whatsapps.join(', ');

    closeQuickContactsModal();
}

function appendUniqueTextareaValues(fieldId, values) {
    const field = document.getElementById(fieldId);
    const current = field.value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    const merged = Array.from(new Set([...current, ...values]));
    field.value = merged.join(', ');
}

function extractContactsFromRows(rows) {
    const emails = new Set();
    const whatsapps = new Set();
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const phoneHeaderPattern = /(whats|telefone|celular|phone|mobile|contato)/i;

    rows.forEach(row => {
        Object.entries(row).forEach(([header, value]) => {
            const text = String(value ?? '').trim();
            if (!text) return;

            const foundEmails = text.match(emailPattern) || [];
            foundEmails.forEach(email => emails.add(email.toLowerCase()));

            if (!phoneHeaderPattern.test(header)) return;
            const digits = text.replace(/\D/g, '');
            if (digits.length >= 10 && digits.length <= 13) {
                whatsapps.add(formatWhatsAppNumber(digits));
            }
        });
    });

    return {
        emails: Array.from(emails),
        whatsapps: Array.from(whatsapps).filter(Boolean)
    };
}

async function handleQuickExcelUpload(input) {
    const file = input.files?.[0];
    if (!file) return;

    try {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        const contacts = extractContactsFromRows(rows);

        if (!contacts.emails.length && !contacts.whatsapps.length) {
            showToast('Nenhum email ou WhatsApp encontrado no arquivo.', 'error');
            return;
        }

        appendUniqueTextareaValues('quick-event-emails', contacts.emails);
        appendUniqueTextareaValues('quick-event-whatsapp', contacts.whatsapps);

        for (const email of contacts.emails) await saveContact(email, 'email');
        for (const whatsapp of contacts.whatsapps) await saveContact(whatsapp, 'whatsapp');

        showToast(`${contacts.emails.length} emails e ${contacts.whatsapps.length} WhatsApps importados.`, 'success');
    } catch (error) {
        console.error('Erro ao importar contatos:', error);
        showToast('Não foi possível importar o arquivo.', 'error');
    } finally {
        input.value = '';
    }
}

// Event listener para fechar modal ao clicar fora
document.getElementById('quick-agenda-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('quick-agenda-modal')) closeQuickAgendaModal();
});

// === FUNÇÕES AUXILIARES PARA AGENDA ===
const DB_NAME = 'AgendaUnificadaDB';
const DB_VERSION = 4;
let db;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (e) => reject(e.target.error);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('unified_contacts')) {
                const store = db.createObjectStore('unified_contacts', { keyPath: 'value' });
                store.createIndex('type', 'type', { unique: false });
            }
            if (!db.objectStoreNames.contains('event_attachments')) {
                db.createObjectStore('event_attachments', { keyPath: 'eventId' });
            }
            if (e.oldVersion < 4) {
                const tx = e.target.transaction;
                const store = tx.objectStore('unified_contacts');
                const request = store.getAll();
                request.onsuccess = () => {
                    const contacts = request.result;
                    contacts.forEach(c => {
                        if (c.deleted === undefined) {
                            c.deleted = false;
                            store.put(c);
                        }
                    });
                };
            }
        };

        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    });
}

async function saveContact(value, type, name = null) {
    if (!db) await initDB().catch(() => null);
    if (!db || !value) return false;
    if (type === 'email' && !value.includes('@')) return false;
    if (type === 'whatsapp' && value.length < 8) return false;

    const tx = db.transaction('unified_contacts', 'readwrite');
    const store = tx.objectStore('unified_contacts');
    let finalValue = value.trim();
    if (type === 'whatsapp') finalValue = formatWhatsAppNumber(value);

    try {
        await new Promise((resolve, reject) => {
            const request = store.put({ value: finalValue, type, name, addedAt: new Date(), deleted: false });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        return true;
    } catch (e) {
        console.error("Erro ao salvar contato:", e);
        return false;
    }
}

async function saveAttachmentToDB(eventId, fileData) {
    if (!db || !fileData) return;
    const tx = db.transaction('event_attachments', 'readwrite');
    const store = tx.objectStore('event_attachments');
    await store.put({ eventId: eventId, data: fileData });
}

function formatWhatsAppNumber(num) {
    let clean = num.replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10 || clean.length === 11) return '55' + clean;
    return clean;
}

function updateMonthDisplay() {
    const txt = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('current-month-display').textContent = txt;
    document.getElementById('print-month-title').textContent = txt;
    document.getElementById('rep-month-label').textContent = txt;
    document.getElementById('print-date-generated').textContent = new Date().toLocaleString('pt-BR');
}

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    currentDate.setDate(1);
    updateMonthDisplay();
    renderUI();
}

function setSystemMode(mode, shouldRender = true) {
    currentMode = mode;
    document.getElementById('btn-mode-schedule').className = mode === 'schedule' ? "px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md bg-white text-slate-900 ring-1 ring-slate-300" : "px-5 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all";
    document.getElementById('btn-mode-attendance').className = mode === 'attendance' ? "px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md bg-white text-slate-900 ring-1 ring-slate-300" : "px-5 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all";

    const entityLabel = mode === 'schedule' ? 'Equipe' : 'Alunos';
    document.getElementById('sidebar-label').innerText = entityLabel;

    const title = mode === 'schedule' ? "Escala Mensal" : "Registro de Presença";
    document.getElementById('print-header-title').innerText = title;

    document.getElementById('schedule-controls').classList.toggle('hidden', mode === 'attendance');

    if (shouldRender) {
        renderMatrix();
        saveData();
    }
}

async function handleGenerateTrigger() {
    if (employees.length === 0) return showToast("Adicione colaboradores primeiro", "error");

    const list = document.getElementById('dates-checkbox-list');
    list.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    await syncNationalHolidays(year, true);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysNames = ["D", "S", "T", "Q", "Q", "S", "S"];

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dw = date.getDay();
        const isWE = dw === 0 || dw === 6;
        const iso = date.toISOString().split('T')[0];
        const checked = selectedDays.includes(d) ? 'checked' : (isWE ? '' : 'checked');

        list.innerHTML += `
            <div class="flex items-center justify-between p-3 rounded-2xl hover:border-indigo-200 transition-colors shadow-sm" style="background:#fff; border:1px solid #e2e8f0;">
                <label class="flex items-center gap-4 cursor-pointer flex-1">
                    <input type="checkbox" name="sel-day" value="${d}" ${checked} class="custom-checkbox">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold" style="color:#334155;">Dia ${d.toString().padStart(2, '0')} <span class="font-normal" style="color:#94a3b8;">• ${daysNames[dw]}</span></span>
                        ${holidays[iso] ? `<span class="text-[10px] font-bold uppercase mt-0.5" style="color:#e11d48;">${holidays[iso]}</span>` : ''}
                    </div>
                </label>
                <button onclick="openDayDetails('${iso}', '${d}/${month+1}')" class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ml-2" style="color:#4f46e5; background:#eef2ff;">
                    Detalhes
                </button>
            </div>
        `;
    }
    openModal('date-selection-modal');
}

function toggleAllDatesSelection() {
    const checks = document.querySelectorAll('input[name="sel-day"]');
    const all = Array.from(checks).every(c => c.checked);
    checks.forEach(c => c.checked = !all);
}

function confirmGenerateWithDates() {
    const checkboxes = document.querySelectorAll('input[name="sel-day"]:checked');
    selectedDays = Array.from(checkboxes).map(c => parseInt(c.value));

    if(selectedDays.length === 0) return showToast("Selecione pelo menos um dia.", "error");

    generateSchedule();
    closeModal('date-selection-modal');
}

function generateSchedule() {
    globalHODays = parseInt(document.getElementById('global-ho-days').value) || 2;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    schedule = {};
    const workDays = [];
    const employeeStats = new Map(employees.map(emp => [emp.id, { ho: 0, ep: 0, blocked: 0 }]));

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const iso = dateObj.toISOString().split('T')[0];
        const dayWeek = dateObj.getDay();
        const dateKey = `${year}-${month}-${d}`;
        const isHolidayDate = holidays[iso] && ['FERIADO', 'FACULTATIVO'].includes(holidays[iso]);
        const isWeekend = dayWeek === 0 || dayWeek === 6;

        if (!selectedDays.includes(d) || isWeekend || isHolidayDate) continue;

        schedule[dateKey] = [];
        workDays.push({
            day: d,
            iso,
            dateKey,
            dateObj,
            workIdx: dayWeek - 1,
            weekKey: getWeekKey(dateObj)
        });
    }

    const weeks = workDays.reduce((map, day) => {
        if (!map.has(day.weekKey)) map.set(day.weekKey, []);
        map.get(day.weekKey).push(day);
        return map;
    }, new Map());

    weeks.forEach((weekDays, weekKey) => {
        const dayLoad = new Map(weekDays.map(day => [day.dateKey, 0]));
        const weekNumber = Number(weekKey.split('-W')[1] || 0);
        const eligibleByEmployee = employees.map((emp, empIndex) => {
            const eligibleDays = weekDays.filter(day =>
                !isEmployeeOnVacation(emp.id, day.dateObj) &&
                !isEmployeeStatusActive(emp, day.dateObj)
            );

            const preferredPattern = generatePatternForDays(globalHODays, empIndex + weekNumber);
            return {
                emp,
                empIndex,
                eligibleDays,
                target: Math.min(globalHODays, eligibleDays.length),
                preferredPattern
            };
        }).filter(item => item.target > 0);

        const totalSlots = eligibleByEmployee.reduce((sum, item) => sum + item.target, 0);
        const balancedDailyLimit = Math.max(1, Math.ceil(totalSlots / Math.max(weekDays.length, 1)));

        eligibleByEmployee
            .sort((a, b) => {
                const statDiff = employeeStats.get(a.emp.id).ho - employeeStats.get(b.emp.id).ho;
                if (statDiff !== 0) return statDiff;
                return a.emp.name.localeCompare(b.emp.name, 'pt-BR');
            })
            .forEach(item => {
                const chosen = [];
                for (let slot = 0; slot < item.target; slot++) {
                    const bestDay = item.eligibleDays
                        .filter(day => !chosen.includes(day.dateKey))
                        .sort((a, b) => scoreScheduleDay(a, item, chosen, dayLoad, balancedDailyLimit) - scoreScheduleDay(b, item, chosen, dayLoad, balancedDailyLimit))[0];

                    if (!bestDay) break;
                    chosen.push(bestDay.dateKey);
                    schedule[bestDay.dateKey].push(item.emp.id);
                    dayLoad.set(bestDay.dateKey, dayLoad.get(bestDay.dateKey) + 1);
                    employeeStats.get(item.emp.id).ho++;
                }
            });
    });

    workDays.forEach(day => {
        employees.forEach(emp => {
            const stat = employeeStats.get(emp.id);
            if (isEmployeeOnVacation(emp.id, day.dateObj) || isEmployeeStatusActive(emp, day.dateObj)) {
                stat.blocked++;
                return;
            }
            if (!schedule[day.dateKey]?.includes(emp.id)) stat.ep++;
        });
    });

    isScheduleGenerated = true;
    saveData();
    renderUI();
    showToast(buildScheduleSummary(workDays, employeeStats));
}

function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function scoreScheduleDay(day, item, chosen, dayLoad, balancedDailyLimit) {
    const load = dayLoad.get(day.dateKey) || 0;
    const loadPenalty = load * 100;
    const overLimitPenalty = Math.max(0, load + 1 - balancedDailyLimit) * 500;
    const preferencePenalty = item.preferredPattern.includes(day.workIdx) ? 0 : 12;
    const consecutivePenalty = chosen.some(key => {
        const selected = item.eligibleDays.find(dayItem => dayItem.dateKey === key);
        return selected && Math.abs(selected.day - day.day) === 1;
    }) ? 18 : 0;
    const rotationTieBreaker = (day.workIdx + item.empIndex) % 5;
    return loadPenalty + overLimitPenalty + preferencePenalty + consecutivePenalty + rotationTieBreaker;
}

function buildScheduleSummary(workDays, employeeStats) {
    const hoTotals = Array.from(employeeStats.values()).map(stat => stat.ho);
    const minHO = hoTotals.length ? Math.min(...hoTotals) : 0;
    const maxHO = hoTotals.length ? Math.max(...hoTotals) : 0;
    const blocked = Array.from(employeeStats.values()).reduce((sum, stat) => sum + stat.blocked, 0);
    const totalHO = hoTotals.reduce((sum, value) => sum + value, 0);
    return `Escala inteligente gerada: ${employees.length} pessoas, ${workDays.length} dias úteis, ${totalHO} HOs, equilíbrio ${minHO}-${maxHO}${blocked ? `, ${blocked} indisponibilidades respeitadas` : ''}.`;
}

function generatePatternForDays(count, index) {
    if (count <= 0) return [];
    if (count >= 5) return [0,1,2,3,4];
    if (count === 2) return hoPairs[index % hoPairs.length];
    const week = [0,1,2,3,4];
    const res = [];
    for(let i=0; i<count; i++) res.push(week[(index + i) % 5]);
    return res.sort();
}

function dragStart(ev, dateKey, empId) {
    if(currentMode === 'attendance') return ev.preventDefault();
    ev.dataTransfer.setData("text/plain", JSON.stringify({sourceDate: dateKey, empId: empId}));
}
function allowDrop(ev) {
    if(currentMode === 'attendance') return;
    ev.preventDefault();
    const cell = ev.target.closest('td');
    if(cell) cell.classList.add('drag-target-active');
}
function dragLeave(ev) {
    const cell = ev.target.closest('td');
    if(cell) cell.classList.remove('drag-target-active');
}
function drop(ev, targetDateKey, targetEmpId) {
    if(currentMode === 'attendance') return;
    ev.preventDefault();
    const cell = ev.target.closest('td');
    if(cell) cell.classList.remove('drag-target-active');
    try {
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        const {sourceDate, empId} = data;
        if (sourceDate === targetDateKey && empId === targetEmpId) return;
        if (schedule[sourceDate]) {
            const idx = schedule[sourceDate].indexOf(empId);
            if (idx > -1) schedule[sourceDate].splice(idx, 1);
        }
        if (!schedule[targetDateKey]) schedule[targetDateKey] = [];
        if (!schedule[targetDateKey].includes(targetEmpId)) schedule[targetDateKey].push(targetEmpId);
        saveData(); renderMatrix();
    } catch (err) { console.error(err); }
}

function renderMatrix() {
    const head = document.getElementById('matrix-head');
    const body = document.getElementById('matrix-body');
    head.innerHTML = ''; body.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const nameColLabel = currentMode === 'schedule' ? 'COLABORADOR' : 'NOME';

    let headerRow = `<tr class="h-12"><th class="sticky-corner px-3 py-2 min-w-[140px] max-w-[160px] border-b text-left bg-gradient-to-r from-white to-slate-50 z-50 shadow-[4px_0_12px_-4px_rgba(99,102,241,0.15)] text-slate-800 font-extrabold text-[11px] tracking-wide">${nameColLabel}</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dw = date.getDay();
        const letter = ["D","S","T","Q","Q","S","S"][dw];
        const iso = date.toISOString().split('T')[0];
        const isActive = selectedDays.includes(d);
        const hol = holidays[iso];
        const details = dayMetadata[iso] || {};

        let bg = isActive ? (dw === 0 || dw === 6 ? 'bg-slate-50' : 'bg-white') : 'bg-slate-100 opacity-40';
        let txt = isActive ? 'text-slate-600' : 'text-slate-400';
        if(hol) { bg = 'bg-rose-50'; txt = 'text-rose-600'; }

        headerRow += `<th class="sticky-header border-b border-r border-slate-100 text-center min-w-[36px] ${bg} ${txt}">
            <div class="flex flex-col items-center justify-center h-full relative group/th">
                <span class="text-[9px] opacity-70 font-semibold">${letter}</span>
                <div class="flex items-center gap-0.5">
                    <span class="text-sm font-bold">${d}</span>
                </div>
                ${details.professor ? `<span class="print-prof-name">${details.professor.split(' ')[0]}</span>` : ''}
            </div>
        </th>`;
    }
    headerRow += `<th class="sticky-header px-2 border-b bg-indigo-50 text-indigo-700 text-center font-black min-w-[50px]">TOT</th></tr>`;
    head.innerHTML = headerRow;

    employees.forEach(emp => {
        let rowHtml = `<tr class="group hover:bg-slate-50/80 transition-colors"><td class="sticky-col px-3 py-2 text-[11px] font-semibold border-b border-r border-slate-100/80 text-slate-700 bg-white group-hover:bg-indigo-50/50 transition-all duration-200 truncate min-w-[140px] max-w-[160px] shadow-[4px_0_12px_-4px_rgba(99,102,241,0.1)] cursor-pointer" onclick="openEmployeeStatusModal(${emp.id})">${emp.name}${emp.status && emp.status !== 'ativo' ? ` <span class="text-xs text-gray-500">(${getStatusAbbrev(emp.status)}${emp.statusNotes ? ' - ' + emp.statusNotes : ''})</span>` : ''}</td>`;
        let total = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${year}-${month}-${d}`;
            const dateObj = new Date(year, month, d);
            const iso = dateObj.toISOString().split('T')[0];
            const isActive = selectedDays.includes(d);
            const hol = holidays[iso];
            const onVac = isEmployeeOnVacation(emp.id, dateObj);
            const isHO = schedule[dateKey]?.includes(emp.id);
            const att = attendance[`${dateKey}-${emp.id}`];

            let cellClass = "border-b border-r border-slate-100 text-center h-10 transition-all text-[10px] select-none ";
            let content = "";
            let click = "";
            let dragAction = "";

            // Verificar se o status do colaborador está ativo nesta data
            const isStatusActive = isEmployeeStatusActive(emp, dateObj);
            if (isStatusActive) {
                // Status de funcionário deve sobrescrever interações da escala (EP/HO)
                cellClass += ` employee-status-${emp.status} cursor-not-allowed`;
                content = getStatusAbbrev(emp.status);
                // Bloqueia ações nessa célula quando o colaborador está com status ativo
                click = '';
                dragAction = '';
            } else if (!isActive) {
                cellClass += "bg-slate-50 opacity-20 cursor-not-allowed";
            } else if (onVac) {
                cellClass += "status-FE";
                content = "FE";
            } else if (hol) {
                if (hol === 'FERIADO') {
                    cellClass += "status-FR";
                    content = "FR";
                } else {
                    // FACULTATIVO
                    cellClass += "status-FA";
                    content = "FA";
                }
            } else if (currentMode === 'schedule') {
                if (isHO) {
                    cellClass += "status-HO font-bold draggable-source hover:opacity-90";
                    content = "HO";
                    dragAction = `draggable="true" ondragstart="dragStart(event, '${dateKey}', ${emp.id})"`;
                } else {
                    cellClass += "status-EP font-black draggable-source hover:opacity-90";
                    content = "EP";
                    total++;
                }
                click = `onclick="toggleCell('${dateKey}', ${emp.id})"`;
                dragAction += ` ondragover="allowDrop(event)" ondragleave="dragLeave(event)" ondrop="drop(event, '${dateKey}', ${emp.id})"`;
            } else {
                const s = att?.status || 'P';
                cellClass += `status-${s} cursor-pointer font-black hover:opacity-80`;
                content = s;
                if(['P','A','S'].includes(s)) total++;
                click = `onclick="openAttendanceModal('${dateKey}', ${emp.id}, '${emp.name}')"`;
            }

            rowHtml += `<td class="${cellClass}" ${click} ${dragAction}>${content}</td>`;
        }
        rowHtml += `<td class="bg-indigo-50/30 text-center text-xs font-black text-indigo-700 border-b border-indigo-100">${total}</td></tr>`;
        body.innerHTML += rowHtml;
    });
    lucide.createIcons();
}

// === FUNÇÕES PARA DETALHES DO DIA ===
function openDayDetails(isoDate, displayDate) {
    currentDayDetailKey = isoDate;
    const details = dayMetadata[isoDate] || {};

    document.getElementById('day-details-subtitle').innerText = displayDate;
    document.getElementById('day-professor').value = details.professor || "";
    document.getElementById('day-subject').value = details.subject || "";
    document.getElementById('day-start').value = details.start || "";
    document.getElementById('day-end').value = details.end || "";

    openModal('day-details-modal');
}

function saveDayDetails() {
    if (!currentDayDetailKey) return;

    const prof = document.getElementById('day-professor').value;
    const subj = document.getElementById('day-subject').value;
    const start = document.getElementById('day-start').value;
    const end = document.getElementById('day-end').value;

    if (!prof && !subj && !start && !end) {
        delete dayMetadata[currentDayDetailKey];
    } else {
        dayMetadata[currentDayDetailKey] = {
            professor: prof,
            subject: subj,
            start: start,
            end: end
        };
    }

    saveData();
    // Atualiza o display se estiver no modal de datas para refletir que tem dados (opcional, mas não mudamos o HTML do modal aqui)
    // Re-renderiza a matriz para caso o usuário feche o modal de datas e olhe o cabeçalho (embora o cabeçalho seja atualizado no renderMatrix)
    // Se estivermos dentro do modal de datas, não precisamos fechar ele, apenas o modal de detalhes
    closeModal('day-details-modal');
    showToast("Detalhes do dia salvos.");
}

function openAttendanceModal(key, id, name) {
    currentAttKey = `${key}-${id}`;
    const att = attendance[currentAttKey] || {};

    document.getElementById('att-modal-title').innerText = name;
    document.getElementById('att-modal-subtitle').innerText = key.split('-').reverse().join('/');

    document.getElementById('att-subject').value = att.subject || "";
    document.getElementById('att-time-start').value = att.timeStart || "";
    document.getElementById('att-time-end').value = att.timeEnd || "";
    document.getElementById('att-obs').value = att.obs || "";

    const radios = document.getElementsByName('att-status');
    radios.forEach(r => r.checked = r.value === (att.status || 'P'));

    toggleJustification(att.status === 'J');
    openModal('attendance-modal');
}

function toggleJustification(show) { document.getElementById('justification-fields').classList.toggle('hidden', !show); }

function saveAttendance() {
    const status = document.querySelector('input[name="att-status"]:checked').value;
    const obs = document.getElementById('att-obs').value;
    if(status === 'J' && !obs) return showToast("Observação obrigatória para justificativa.", "error");

    attendance[currentAttKey] = {
        status,
        subject: document.getElementById('att-subject').value,
        timeStart: document.getElementById('att-time-start').value,
        timeEnd: document.getElementById('att-time-end').value,
        obs: obs
    };
    saveData(); renderMatrix(); closeModal('attendance-modal');
    showToast("Registro salvo");
}

function openImportFilePicker() {
    document.getElementById('file-input')?.click();
}

function isSupportedImportFile(file) {
    return Boolean(file && /\.(xlsx|xls|csv)$/i.test(file.name));
}

function setEmptyDropActive(active) {
    document.getElementById('empty-state')?.classList.toggle('is-dragging-file', active);
}

function handleEmptyDropEnter(event) {
    event.preventDefault();
    setEmptyDropActive(true);
}

function handleEmptyDropOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setEmptyDropActive(true);
}

function handleEmptyDropLeave(event) {
    const zone = document.getElementById('empty-state');
    if (!zone || zone.contains(event.relatedTarget)) return;
    setEmptyDropActive(false);
}

function handleEmptyDrop(event) {
    event.preventDefault();
    setEmptyDropActive(false);

    const file = event.dataTransfer?.files?.[0];
    if (!isSupportedImportFile(file)) {
        showToast('Arraste um arquivo XLSX, XLS ou CSV.', 'error');
        return;
    }

    importScheduleFile(file);
}

function importScheduleFile(file) {
    if (!isSupportedImportFile(file)) {
        showToast('Selecione um arquivo XLSX, XLS ou CSV.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(e.target.result, {type:'binary'});
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws, {defval: ''});
            if (!jsonData.length) return showToast('Arquivo vazio.', 'error');
            const headers = Object.keys(jsonData[0] || {});
            if (!headers.length) return showToast('Cabeçalhos não encontrados.', 'error');
            renderImportMappingModal(headers, jsonData);
        } catch (error) {
            console.error('Erro ao ler arquivo de importação:', error);
            showToast('Não foi possível ler a planilha.', 'error');
        }
    };
    reader.readAsBinaryString(file);
}

function handleFileUpload(input) {
    const file = input.files?.[0];
    if(!file) return;
    importScheduleFile(file);
    input.value = '';
}

function openReportsModal() {
    // Limpa o campo de busca ao abrir
    document.getElementById('rep-search').value = '';

    renderReportsTable();
    openModal('reports-modal');
}

// Função separada para renderizar a tabela de relatórios, permitindo filtragem
function renderReportsTable() {
    const tbody = document.getElementById('reports-body');
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('rep-search').value.toLowerCase();

    let grandP = 0, grandF = 0, grandJ = 0, grandPossible = 0;

    const chartLabels = [];
    const chartDataP = [];
    const chartDataF = [];
    const chartDataJ = [];

    employees.forEach(emp => {
        // Filtro de Busca
        if (searchTerm && !emp.name.toLowerCase().includes(searchTerm)) return;

        let p = 0, f = 0, j = 0, count = 0;
        selectedDays.forEach(d => {
            const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${d}`;
            const att = attendance[key + '-' + emp.id]?.status || 'P';
            if(['P','A','S'].includes(att)) p++; else if(att === 'F') f++; else if(att === 'J') j++;
            count++;
        });
        grandP += p; grandF += f; grandJ += j; grandPossible += count;
        const freq = count > 0 ? Math.round((p/count)*100) : 0;
        const color = freq >= 90 ? 'text-emerald-600' : (freq >= 70 ? 'text-amber-600' : 'text-rose-600');

        tbody.innerHTML += `<tr><td class="p-4 font-bold text-slate-700">${emp.name}</td><td class="p-4 text-center text-emerald-600 font-bold bg-emerald-50/30 rounded-lg">${p}</td><td class="p-4 text-center text-rose-600 font-bold bg-rose-50/30 rounded-lg">${f}</td><td class="p-4 text-center text-blue-600 font-bold bg-blue-50/30 rounded-lg">${j}</td><td class="p-4"><div class="flex items-center gap-3"><span class="text-xs font-black ${color} w-8">${freq}%</span><div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${freq >= 70 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${freq}%"></div></div></div></td></tr>`;

        chartLabels.push(emp.name);
        chartDataP.push(p);
        chartDataF.push(f);
        chartDataJ.push(j);
    });

    document.getElementById('rep-total-presencas').innerText = grandP;
    document.getElementById('rep-total-faltas').innerText = grandF;
    document.getElementById('rep-total-just').innerText = grandJ;
    document.getElementById('rep-freq-geral').innerText = grandPossible > 0 ? Math.round((grandP/grandPossible)*100) + '%' : '0%';

    renderChart(chartLabels, chartDataP, chartDataF, chartDataJ);
}

// Função de filtro acionada pelo input
function filterReports() {
    renderReportsTable();
}

// Função para imprimir APENAS o relatório
function printReport() {
    document.body.classList.add('printing-report');
    window.print();
    // Remove a classe após a impressão (ou cancelamento) para voltar ao normal
    // setTimeout é usado para garantir que o navegador detecte o estado de impressão antes de remover
    setTimeout(() => {
        document.body.classList.remove('printing-report');
    }, 500);
}

function renderChart(labels, dataP, dataF, dataJ) {
    const ctx = document.getElementById('attendance-chart').getContext('2d');
    if (attendanceChart) attendanceChart.destroy();

    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Presenças', data: dataP, backgroundColor: '#10b981', borderRadius: 4, barThickness: 10 },
                { label: 'Faltas', data: dataF, backgroundColor: '#f43f5e', borderRadius: 4, barThickness: 10 },
                { label: 'Justificadas', data: dataJ, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 10 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ============================================
// === NOVO PORTAL DO COLABORADOR MODERNO ===
// ============================================
function downloadPortalFile() {
    const data = { employees, schedule, attendance, holidays, context, year: currentDate.getFullYear(), month: currentDate.getMonth(), monthName: currentDate.toLocaleDateString('pt-BR', {month:'long'}), selectedDays };

    // HTML do Portal Moderno embutido como string
    const portalHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Portal do Colaborador • ${data.monthName}</title>
    <script src="https://cdn.tailwindcss.com"></`+`script>
    <script src="https://unpkg.com/lucide@latest"></`+`script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
* { font-family: 'Plus Jakarta Sans', sans-serif; }

/* === PREMIUM BACKGROUND === */
body {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
    color: #1e293b;
    -webkit-tap-highlight-color: transparent;
    min-height: 100vh;
}
body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
        radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
}

/* === GLASS MORPHISM === */
.glass {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.3);
}
.glass-dark {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(99, 102, 241, 0.2);
}

/* === CARD PREMIUM === */
.card-premium {
    box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border-radius: 2rem;
}
.card-shadow {
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* === STATUS BADGES PREMIUM === */
.status-ho {
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    color: #166534;
    border: 1px solid #86efac;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);
}
.status-ep {
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
    color: #0369a1;
    border: 1px solid #7dd3fc;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2);
}

/* === TIMELINE === */
.timeline-line { position: absolute; left: 24px; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, #e2e8f0, #cbd5e1); z-index: 0; }

/* === ANIMATIONS === */
.slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(30px); }
@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }
.animate-float { animation: float 6s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.animate-pulse-slow { animation: pulseSlow 3s ease-in-out infinite; }
@keyframes pulseSlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

/* === SCROLLBAR === */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #6366f1, #8b5cf6); border-radius: 10px; }

/* === LOGIN PREMIUM === */
.login-container {
    background: linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%);
    border: 1px solid rgba(255,255,255,0.5);
}
.login-icon {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
    box-shadow: 0 10px 40px -10px rgba(99, 102, 241, 0.5);
}
.login-btn {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    transition: all 0.3s ease;
}
.login-btn:hover {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    box-shadow: 0 10px 40px -10px rgba(99, 102, 241, 0.5);
    transform: translateY(-2px);
}

/* === CSS PARA IMPRESSÃO - RELATÓRIO PREMIUM === */
@media print {
    @page { margin: 10mm; size: portrait; }

    body {
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    body::before { display: none !important; }

    #login-screen, .no-print { display: none !important; }
    #app-dashboard { display: none !important; }
    #print-report { display: block !important; }

    .print-header {
        text-align: center;
        border-bottom: 3px solid #000;
        padding-bottom: 15px;
        margin-bottom: 20px;
    }
    .print-header h1 {
        font-size: 18px;
        font-weight: 900;
        color: #000;
        margin: 0;
    }
    .print-header p {
        font-size: 12px;
        color: #333;
        margin: 5px 0 0;
    }
    .print-summary {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid #000;
    }
    .print-summary-item {
        text-align: center;
    }
    .print-summary-item span {
        display: block;
        font-size: 24px;
        font-weight: 900;
        color: #000;
    }
    .print-summary-item small {
        font-size: 10px;
        color: #333;
        text-transform: uppercase;
    }
    .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
    }
    .print-table th, .print-table td {
        border: 1px solid #000;
        padding: 6px 8px;
        text-align: left;
    }
    .print-table th {
        background-color: #e2e8f0;
        font-weight: 700;
        text-transform: uppercase;
    }
    .print-table tr:nth-child(even) {
        background-color: #f8fafc;
    }
    .badge-ho, .badge-ep {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 9px;
    }
    .badge-ho {
        background-color: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
    }
    .badge-ep {
        background-color: #dbeafe;
        color: #1e40af;
        border: 1px solid #93c5fd;
    }
    .print-footer {
        margin-top: 30px;
        display: flex;
        justify-content: space-around;
    }
    .signature-line {
        width: 200px;
        border-top: 1px solid #000;
        text-align: center;
        padding-top: 5px;
        font-size: 10px;
    }
}
    </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">

    <!-- TELA DE LOGIN PREMIUM -->
    <div id="login-screen" class="relative z-10 w-full max-w-sm login-container rounded-3xl p-8 card-premium text-center slide-up">
<div class="w-20 h-20 login-icon rounded-2xl mx-auto flex items-center justify-center mb-6 animate-float">
    <i data-lucide="layers" class="text-white w-10 h-10"></i>
</div>
<h1 class="text-2xl font-black text-slate-900 mb-2">Portal do Colaborador</h1>
<p class="text-slate-500 text-sm mb-8 font-medium">Acesse sua escala de <span class="text-indigo-600 font-bold capitalize">${data.monthName}</span></p>

<div class="relative group mb-4">
    <i data-lucide="search" class="absolute left-4 top-3.5 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors"></i>
    <input type="text" id="login-name" placeholder="Digite seu nome..." class="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 placeholder:font-medium" onkeyup="if(event.key==='Enter') doLogin()">
</div>

<button onclick="doLogin()" class="w-full py-3.5 login-btn text-white rounded-xl font-bold active:scale-95 transition-all">
    ENTRAR
</button>

<p class="text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold">Matrix Pro Premium</p>
    </div>

    <!-- RELATÓRIO PARA IMPRESSÃO (OCULTO NA TELA) -->
    <div id="print-report" style="display: none;">
<div class="print-header">
    <h1>RELATÓRIO DE ESCALA MENSAL</h1>
    <p id="print-user-info"></p>
</div>
<div class="print-summary">
    <div class="print-summary-item">
        <span id="print-total-ep">0</span>
        <small>Dias Presenciais</small>
    </div>
    <div class="print-summary-item">
        <span id="print-total-ho">0</span>
        <small>Dias Home Office</small>
    </div>
    <div class="print-summary-item">
        <span id="print-total-dias">0</span>
        <small>Total de Dias</small>
    </div>
</div>
<table class="print-table">
    <thead>
        <tr>
            <th>Dia</th>
            <th>Dia da Semana</th>
            <th>Modalidade</th>
            <th>Local</th>
        </tr>
    </thead>
    <tbody id="print-table-body"></tbody>
</table>
<div class="print-footer">
    <div class="signature-line">Colaborador</div>
    <div class="signature-line">Gestor Responsável</div>
</div>
    </div>

    <!-- DASHBOARD PREMIUM -->
    <div id="app-dashboard" class="hidden relative z-10 w-full max-w-md h-[95vh] glass rounded-[40px] card-premium overflow-hidden flex flex-col border border-white/20">
<!-- Header Premium -->
<div class="px-6 pt-8 pb-4 bg-white/80 backdrop-blur-xl z-10 sticky top-0 border-b border-slate-100/50">
    <div class="flex justify-between items-start mb-6">
        <div>
            <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Bem-vindo(a),</p>
            <h2 class="text-2xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent leading-tight" id="user-name">Colaborador</h2>
        </div>
        <div class="flex gap-2">
            <button onclick="printReport()" class="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all no-print" title="Imprimir Escala"><i data-lucide="printer" class="w-5 h-5"></i></button>
            <button onclick="logout()" class="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors no-print" title="Sair"><i data-lucide="log-out" class="w-5 h-5"></i></button>
        </div>
    </div>

    <!-- Cards de Resumo Premium -->
    <div class="grid grid-cols-2 gap-3">
        <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex flex-col items-center justify-center text-center group hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
            <span class="text-3xl font-black bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent" id="total-ep">0</span>
            <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Presencial</span>
        </div>
        <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex flex-col items-center justify-center text-center group hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
            <span class="text-3xl font-black bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent" id="total-ho">0</span>
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Home Office</span>
        </div>
    </div>
</div>

<!-- Agenda Scrollável Premium -->
<div class="flex-1 overflow-y-auto custom-scrollbar relative p-6 bg-white/50">
    <h3 class="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 sticky top-0 bg-white/80 backdrop-blur-sm py-2 z-10 rounded-xl px-3">
        <i data-lucide="calendar" class="w-4 h-4 text-indigo-500"></i>
        Sua Agenda de <span class="capitalize text-indigo-600">${data.monthName}</span>
    </h3>

    <div class="space-y-4" id="agenda-list">
        <!-- Itens da Agenda serão injetados aqui -->
    </div>
</div>

<!-- Barra Inferior Premium -->
<div class="p-4 border-t border-slate-100/50 bg-white/80 backdrop-blur-xl absolute bottom-0 w-full flex justify-center no-print">
    <div class="text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent uppercase tracking-widest">Matrix Pro Premium</div>
</div>
    </div>

    <script>
const DATA = ${JSON.stringify(data)};

function doLogin() {
    const input = document.getElementById('login-name');
    const name = input.value.trim().toLowerCase();
    if(name.length < 3) return alert("Digite pelo menos 3 letras.");

    const user = DATA.employees.find(e => e.name.toLowerCase().includes(name));
    if(!user) return alert("Colaborador não encontrado. Verifique o nome.");

    renderDashboard(user);
}

function renderDashboard(user) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden');
    document.getElementById('user-name').innerText = user.name.split(' ')[0];

    let countEP = 0;
    let countHO = 0;
    const list = document.getElementById('agenda-list');
    list.innerHTML = '<div class="timeline-line"></div>';

    DATA.selectedDays.forEach((d, index) => {
        const dateKey = \`\${DATA.year}-\${DATA.month}-\${d}\`;
        const isHO = DATA.schedule[dateKey] && DATA.schedule[dateKey].includes(user.id);
        const dateObj = new Date(DATA.year, DATA.month, d);
        const weekDay = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dateObj.getDay()];
        const weekDayShort = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][dateObj.getDay()];

        if(isHO) countHO++; else countEP++;

        // Estilos Baseados no Tipo
        const bgClass = isHO ? 'bg-white' : 'bg-emerald-50/50';
        const borderClass = isHO ? 'border-slate-100' : 'border-emerald-100';
        const iconBg = isHO ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600';
        const icon = isHO ? 'home' : 'briefcase';
        const typeLabel = isHO ? 'Home Office' : 'Presencial';
        const typeSub = isHO ? 'Trabalho Remoto' : 'Escritório Central';

        const delay = index * 0.05;

        const itemHTML = \`
            <div class="relative z-10 flex gap-4 animate-slide-up item-container" style="animation-delay: \${delay}s">
                <div class="flex flex-col items-center">
                    <div class="w-12 h-12 rounded-2xl \${isHO ? 'bg-slate-50 text-slate-600' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'} flex flex-col items-center justify-center border border-slate-100 z-10 font-bold shrink-0">
                        <span class="text-[8px] uppercase opacity-70 leading-none mb-0.5">\${weekDayShort}</span>
                        <span class="text-lg leading-none">\${d}</span>
                    </div>
                </div>
                <div class="flex-1 p-4 rounded-2xl border \${borderClass} \${bgClass} card-shadow flex justify-between items-center group active:scale-[0.98] transition-transform">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">\${typeLabel}</h4>
                        <p class="text-xs text-slate-500">\${typeSub}</p>
                    </div>
                    <div class="w-8 h-8 rounded-full \${iconBg} flex items-center justify-center">
                        <i data-lucide="\${icon}" class="w-4 h-4"></i>
                    </div>
                </div>
            </div>
        \`;
        list.innerHTML += itemHTML;
    });

    document.getElementById('total-ep').innerText = countEP;
    document.getElementById('total-ho').innerText = countHO;

    // Preencher relatório de impressão
    document.getElementById('print-user-info').innerHTML =
        '<strong>Colaborador:</strong> ' + user.name + ' | ' +
        '<strong>Mês:</strong> ' + DATA.monthName.charAt(0).toUpperCase() + DATA.monthName.slice(1) + '/' + DATA.year;
    document.getElementById('print-total-ep').innerText = countEP;
    document.getElementById('print-total-ho').innerText = countHO;
    document.getElementById('print-total-dias').innerText = countEP + countHO;

    // Preencher tabela de impressão
    const printBody = document.getElementById('print-table-body');
    printBody.innerHTML = '';
    DATA.selectedDays.forEach(d => {
        const dateKey = \`\${DATA.year}-\${DATA.month}-\${d}\`;
        const isHO = DATA.schedule[dateKey] && DATA.schedule[dateKey].includes(user.id);
        const dateObj = new Date(DATA.year, DATA.month, d);
        const weekDay = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][dateObj.getDay()];
        const modalidade = isHO ? '<span class="badge-ho">HOME OFFICE</span>' : '<span class="badge-ep">PRESENCIAL</span>';
        const local = isHO ? 'Trabalho Remoto' : 'Escritório Central';

        printBody.innerHTML += \`
            <tr>
                <td>\${String(d).padStart(2, '0')}/\${String(DATA.month + 1).padStart(2, '0')}/\${DATA.year}</td>
                <td>\${weekDay}</td>
                <td>\${modalidade}</td>
                <td>\${local}</td>
            </tr>
        \`;
    });

    lucide.createIcons();
}

function printReport() {
    window.print();
}

function logout() {
    location.reload();
}
    </`+`script>
</body>
</html>
    `;

    const blob = new Blob([portalHTML], {type:'text/html'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Portal_Matrix_${data.monthName}.html`; a.click();
}

function toggleCell(key, id) { if(!schedule[key]) schedule[key] = []; const i = schedule[key].indexOf(id); if(i > -1) schedule[key].splice(i, 1); else schedule[key].push(id); saveData(); renderMatrix(); }
function isEmployeeOnVacation(empId, date) { const v = vacations[empId] || []; const t = date.getTime(); return v.some(x => t >= new Date(x.start+'T00:00:00').getTime() && t <= new Date(x.end+'T00:00:00').getTime()); }
function isEmployeeStatusActive(emp, date) { if (!emp.status || emp.status === 'ativo') return false; if (!emp.statusStart) return true; const t = date.getTime(); const start = new Date(emp.statusStart+'T00:00:00').getTime(); const end = emp.statusEnd ? new Date(emp.statusEnd+'T00:00:00').getTime() : Infinity; return t >= start && t <= end; }
function getStatusAbbrev(status) { const abbrevs = {inativo: 'IN', desligado: 'DESL', maternidade: 'LM', paternidade: 'LP'}; return abbrevs[status] || status.toUpperCase(); }
function addEmployee() { const n = document.getElementById('new-emp-name').value.trim(); if(!n) return; employees.push({id:Date.now(), name:n}); document.getElementById('new-emp-name').value=''; saveData(); renderUI(); }
function removeEmployee(id) { employees = employees.filter(e => e.id !== id); saveData(); renderUI(); }
function handleClearEmployees() { employees = []; students = []; isScheduleGenerated = false; saveData(); renderUI(); }
function handleReset() { if(confirm("Tem certeza? Isso apagará todos os dados.")) { localStorage.clear(); location.reload(); } }
function saveContext() { context.local=document.getElementById('ctx-local').value; context.unidade=document.getElementById('ctx-unidade').value; context.sala=document.getElementById('ctx-sala').value; saveData(); renderContextUI(); closeModal('context-modal'); }
function renderContextUI() { document.getElementById('header-local').innerText=context.local || "Gestão"; document.getElementById('header-unidade').innerText=context.unidade||"Inteligente"; document.getElementById('header-sep').className=context.local?'mx-1':'hidden'; document.getElementById('print-context').innerHTML=`<span>LOCAL: ${context.local||'-'}</span> <span>UNIDADE: ${context.unidade||'-'}</span> <span>SALA: ${context.sala||'-'}</span>`; }

function renderEmployeeList() {
    const query = document.getElementById('emp-search').value.toLowerCase();
    const l = document.getElementById('employee-list');
    l.innerHTML = '';
    const filtered = employees.filter(e => e.name.toLowerCase().includes(query));
    document.getElementById('emp-count').innerText = employees.length;
    filtered.forEach(e => {
        l.innerHTML += `<div class="p-6 bg-white border border-slate-200 rounded-2xl text-[16px] font-semibold shadow-sm flex justify-between items-center gap-4 group transition-all hover:border-indigo-300 hover:shadow-md mb-4"><span class="block break-words pr-2 text-slate-700 leading-7">${e.name}</span><button onclick="removeEmployee(${e.id})" class="opacity-100 text-slate-400 hover:text-rose-500 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`;
    });
    lucide.createIcons();
}

function renderUI() { renderEmployeeList(); renderContextUI(); if(employees.length > 0) { document.getElementById('empty-state').classList.add('hidden'); document.getElementById('matrix-container').classList.remove('hidden'); renderMatrix(); document.getElementById('btn-portal').disabled = !isScheduleGenerated; } else { document.getElementById('empty-state').classList.remove('hidden'); document.getElementById('matrix-container').classList.add('hidden'); } updateDashboard(); applyRolePermissions(); }
function openContextModal() { document.getElementById('ctx-local').value = context.local || ""; document.getElementById('ctx-unidade').value = context.unidade || ""; document.getElementById('ctx-sala').value = context.sala || ""; openModal('context-modal'); }
function openVacationModal() { const s = document.getElementById('vacation-emp-select'); s.innerHTML = '<option value="">Selecione...</option>'; employees.forEach(e => s.innerHTML += `<option value="${e.id}">${e.name}</option>`); renderVacationList(); openModal('vacation-modal'); }
function openHolidayModal() { renderHolidayList(); openModal('holiday-modal'); }
function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
        {
            "Dados Pessoais": "",
            "ID do Aluno": "A001",
            "Nome Completo": "João Silva",
            "Nome Social": "",
            "CPF": "",
            "RG": "",
            "Data de Nascimento": "",
            "Idade": "",
            "Sexo": "",
            "Estado Civil": "",
            "Nacionalidade": "",
            "📍 Contato e Endereço": "",
            "E-mail": "",
            "Telefone": "",
            "WhatsApp": "",
            "Nome do Responsável": "",
            "Telefone do Responsável": "",
            "Endereço": "",
            "Bairro": "",
            "Cidade": "",
            "Estado": "",
            "CEP": "",
            "🏫 Dados Acadêmicos": "",
            "Matrícula": "",
            "Curso": "",
            "Turma": "",
            "Série / Período": "",
            "Turno": "",
            "Modalidade (Presencial / EAD / Híbrido)": "",
            "Data de Matrícula": "",
            "Situação do Aluno (Ativo / Trancado / Concluído)": "",
            "Ano Letivo": "",
            "Semestre": "",
            "📚 Desempenho Escolar": "",
            "Disciplina": "",
            "Professor": "",
            "Nota 1": "",
            "Nota 2": "",
            "Nota 3": "",
            "Média Final": "",
            "Frequência (%)": "",
            "Total de Faltas": "",
            "Situação Final (Aprovado / Reprovado)": "",
            "Recuperação": "",
            "📝 Controle e Observações": "",
            "Data da Última Avaliação": "",
            "Data da Última Atualização": "",
            "Observações": "",
            "Advertências": "",
            "Ocorrências": "",
            "Necessidades Especiais": "",
            "Bolsa / Desconto": "",
            "Valor da Mensalidade": "",
            "Status Financeiro": "",
            "Assinatura / Responsável": ""
        }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_escala.xlsx");
}
function exportToExcel() {
    if(!isScheduleGenerated) return showToast("Gere a escala primeiro", "error");

    // Coletar dados da tabela
    const table = document.querySelector('#matrix-container table');
    if (!table) return showToast("Tabela não encontrada", "error");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);

    // Ajustar larguras das colunas
    const colWidths = [];
    const rows = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : {e: {c: 0, r: 0}};

    for (let c = 0; c <= rows.e.c; c++) {
        let maxWidth = 10; // largura mínima
        for (let r = 0; r <= rows.e.r; r++) {
            const cell = ws[XLSX.utils.encode_cell({c, r})];
            if (cell && cell.v) {
                const cellWidth = String(cell.v).length;
                if (cellWidth > maxWidth) maxWidth = cellWidth;
            }
        }
        colWidths.push({wch: Math.min(maxWidth, 20)}); // largura máxima de 20
    }
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Escala");
    XLSX.writeFile(wb, "Escala.xlsx");
    showToast("Excel exportado com sucesso!");
}

function addVacation() { const empId = Number(document.getElementById('vacation-emp-select').value); const start = document.getElementById('vacation-start').value; const end = document.getElementById('vacation-end').value; if(!empId || !start || !end) return; if(!vacations[empId]) vacations[empId] = []; vacations[empId].push({start, end}); saveData(); renderVacationList(); renderMatrix(); showToast("Férias salvas"); }
function renderVacationList() { const list = document.getElementById('vacation-list'); list.innerHTML = ''; Object.keys(vacations).forEach(id => { const emp = employees.find(e => e.id == id); if(!emp) return; vacations[id].forEach((v, i) => { list.innerHTML += `<div class="p-4 bg-white border border-slate-100 rounded-2xl mb-2 flex justify-between items-center text-xs shadow-sm"><div><span class="font-bold text-slate-700 block mb-1">${emp.name}</span><span class="text-slate-400">${v.start.split('-').reverse().join('/')} até ${v.end.split('-').reverse().join('/')}</span></div><button onclick="vacations[${id}].splice(${i},1); saveData(); renderVacationList();" class="text-rose-400 bg-rose-50 p-1.5 rounded-lg hover:bg-rose-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`; }); }); lucide.createIcons(); }
function addHoliday() { const d = document.getElementById('holiday-date').value; const t = document.getElementById('holiday-type').value; if(!d) return; holidays[d] = t; saveData(); renderHolidayList(); renderMatrix(); showToast("Feriado salvo"); }
function renderHolidayList() { const list = document.getElementById('holiday-list'); list.innerHTML = ''; Object.keys(holidays).sort().forEach(d => { list.innerHTML += `<div class="p-4 bg-white border border-slate-100 rounded-2xl mb-2 flex justify-between items-center text-xs shadow-sm"><div><span class="font-bold text-slate-700 block mb-1">${d.split('-').reverse().join('/')}</span><span class="text-slate-400 uppercase font-bold text-[10px]">${holidays[d]}</span></div><button onclick="delete holidays['${d}']; saveData(); renderHolidayList();" class="text-rose-400 bg-rose-50 p-1.5 rounded-lg hover:bg-rose-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`; }); lucide.createIcons(); }

// === RELATÓRIOS PARA IMPRESSÃO (AGORA INCLUI ABSENTEÍSMO) ===
function renderReportsForPrint() {
    const justContainer = document.getElementById('print-justifications');
    const detailsContainer = document.getElementById('print-day-details');
    const absencesContainer = document.getElementById('print-absences');

    if (currentMode === 'schedule') {
        // Para escala, mostrar relatório com Nome, Status, Observações
        document.getElementById('print-absences-title').innerText = 'Relatório Individual';
        const absencesBody = document.getElementById('print-absences-body');
        absencesBody.innerHTML = '';

        const sortedEmployees = [...employees].sort((a,b) => a.name.localeCompare(b.name));

        sortedEmployees.forEach(emp => {
            const status = emp.status || 'ativo';
            const observacoes = emp.statusNotes || '';

            absencesBody.innerHTML += `
                <tr class="border-b border-slate-200">
                    <td class="p-2 text-xs font-bold">${emp.name}</td>
                    <td class="p-2 text-xs text-center">${status}</td>
                    <td class="p-2 text-xs">${observacoes}</td>
                </tr>
            `;
        });

        // Atualizar cabeçalho da tabela
        const thead = document.querySelector('#print-absences thead tr');
        thead.innerHTML = `
            <th class="border p-2 font-bold text-slate-700">Nome</th>
            <th class="border p-2 font-bold text-slate-700 text-center">Status</th>
            <th class="border p-2 font-bold text-slate-700">Observações</th>
        `;

        absencesContainer.classList.remove('hidden');
        justContainer.classList.add('hidden');
        detailsContainer.classList.add('hidden');
        return;
    }

    // Para attendance (alunos), mostrar relatório de frequência
    document.getElementById('print-absences-title').innerText = 'Relatório de Frequência Individual';
    const absencesBody = document.getElementById('print-absences-body');
    absencesBody.innerHTML = '';

    const sortedEmployees = [...employees].sort((a,b) => a.name.localeCompare(b.name));
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    sortedEmployees.forEach(emp => {
        let totalWorkDays = 0;
        let totalFails = 0;

        selectedDays.forEach(d => {
            const key = `${year}-${month}-${d}`;
            const att = attendance[key + '-' + emp.id]?.status || 'P'; // Default P para cálculo de % se não preenchido, mas idealmente conta apenas o que foi marcado.

            // Consideramos dias úteis aqueles selecionados
            totalWorkDays++;

            if (att === 'F') {
                totalFails++;
            }
        });

        const percentage = totalWorkDays > 0 ? Math.round((totalFails / totalWorkDays) * 100) : 0;

        // Exibe cores baseadas na porcentagem para alerta visual na impressão
        let percColorClass = "text-emerald-600";
        if(percentage > 0) percColorClass = "text-amber-600";
        if(percentage > 10) percColorClass = "text-rose-600 font-bold";

        const status = emp.status || '';
        const observacoes = emp.statusNotes || '';

        absencesBody.innerHTML += `
            <tr class="border-b border-slate-200">
                <td class="p-2 text-xs font-bold">${emp.name}</td>
                <td class="p-2 text-xs text-center">${status}</td>
                <td class="p-2 text-xs">${observacoes}</td>
                <td class="p-2 text-xs text-center">${totalWorkDays}</td>
                <td class="p-2 text-xs text-center ${totalFails > 0 ? 'text-rose-600 font-bold' : ''}">${totalFails}</td>
                <td class="p-2 text-xs text-center ${percColorClass}">${percentage}%</td>
            </tr>
        `;
    });

    // Atualizar cabeçalho para incluir Status e Observações junto com os dados de frequência
    const thead = document.querySelector('#print-absences thead tr');
    thead.innerHTML = `
        <th class="border p-2 font-bold text-slate-700">Colaborador</th>
        <th class="border p-2 font-bold text-slate-700 text-center">Status</th>
        <th class="border p-2 font-bold text-slate-700">Observações</th>
        <th class="border p-2 font-bold text-slate-700 text-center">Dias Úteis</th>
        <th class="border p-2 font-bold text-slate-700 text-center">Faltas</th>
        <th class="border p-2 font-bold text-slate-700 text-center">% de Falta</th>
    `;

    absencesContainer.classList.remove('hidden');


    // 2. Relatório de Justificativas
    const justBody = document.getElementById('print-justifications-body');
    justBody.innerHTML = '';
    let hasJustifications = false;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${month}-${d}`;
        sortedEmployees.forEach(emp => {
            const key = `${dateKey}-${emp.id}`;
            const record = attendance[key];
            if (record && record.status === 'J') {
                hasJustifications = true;
                const dateStr = `${d.toString().padStart(2,'0')}/${(month+1).toString().padStart(2,'0')}/${year}`;
                justBody.innerHTML += `<tr class="border-b border-slate-200"><td class="p-2 text-xs">${dateStr}</td><td class="p-2 text-xs font-bold">${emp.name}</td><td class="p-2 text-xs italic text-slate-600">${record.obs || 'Sem observação'}</td></tr>`;
            }
        });
    }
    justContainer.classList.toggle('hidden', !hasJustifications);

    // 3. Relatório de Detalhes do Dia
    const detailsBody = document.getElementById('print-day-details-body');
    detailsBody.innerHTML = '';
    let hasDetails = false;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = new Date(year, month, d).toISOString().split('T')[0];
        const details = dayMetadata[dateKey];

        if (details && (details.professor || details.subject || details.start || details.end)) {
            hasDetails = true;
            const dateStr = `${d.toString().padStart(2,'0')}/${(month+1).toString().padStart(2,'0')}/${year}`;

            detailsBody.innerHTML += `
                <tr class="border-b border-slate-200">
                    <td class="p-2 text-xs">${dateStr}</td>
                    <td class="p-2 text-xs font-bold">${details.professor || '-'}</td>
                    <td class="p-2 text-xs">${details.subject || '-'}</td>
                    <td class="p-2 text-xs text-center">${details.start || '-'}</td>
                    <td class="p-2 text-xs text-center">${details.end || '-'}</td>
                </tr>
            `;
        }
    }
    detailsContainer.classList.toggle('hidden', !hasDetails);
}

function renderStudentsForPrint() {
    const container = document.getElementById('print-students');
    const headRow = document.getElementById('print-students-head');
    const body = document.getElementById('print-students-body');

    if (!students.length) {
        container.classList.add('hidden');
        return;
    }

    const filledFields = STUDENT_FIELDS.filter(field =>
        students.some(s => (s[field] ?? '').toString().trim() !== '')
    );

    if (!filledFields.length) {
        container.classList.add('hidden');
        return;
    }

    headRow.innerHTML = filledFields.map(f => `<th>${f}</th>`).join('');
    body.innerHTML = students.map(s => {
        const cols = filledFields.map(f => `<td>${(s[f] ?? '').toString()}</td>`).join('');
        return `<tr>${cols}</tr>`;
    }).join('');

    container.classList.remove('hidden');
}

window.addEventListener('beforeprint', () => {
    renderReportsForPrint();
    renderStudentsForPrint();
});
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    loadData();
    updateMonthDisplay();
    renderUI();
    initTooltips();
    document.getElementById('role-select').value = userRole;
    applyRolePermissions();
    applyTheme();
    initQuickAgendaEnhancements();

    // Inicializar funcionalidades de data
    initDateFeatures();
});

// Funcionalidades Avançadas para Campos de Data
// Lista de Feriados Brasileiros (fixos) - Global
let brazilianHolidays = [
    '01-01', // Ano Novo
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '09-07', // Independência
    '10-12', // Nossa Senhora Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '12-25', // Natal
];

async function syncNationalHolidays(year, persist = false) {
    if (nationalHolidayCache[year]) return nationalHolidayCache[year];

    try {
        const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`BrasilAPI retornou ${response.status}`);

        const items = await response.json();
        nationalHolidayCache[year] = items;
        items.forEach(item => {
            if (item?.date && !holidays[item.date]) holidays[item.date] = 'FERIADO';
        });
        if (persist) saveData();
        return items;
    } catch (error) {
        console.warn('Feriados nacionais indisponíveis:', error);
        nationalHolidayCache[year] = [];
        return [];
    }
}

function isHoliday(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const monthDay = `${month}-${day}`;
    return brazilianHolidays.includes(monthDay);
}

function initDateFeatures() {

const dateInput = document.getElementById('quick-event-date');

// Modificar validação de data
dateInput.addEventListener('change', function() {
    const selectedDate = new Date(this.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        if (!confirm('Esta data é no passado. Deseja agendar mesmo assim?')) {
            this.value = today.toISOString().split('T')[0];
            return;
        }
    }

    if (isHoliday(selectedDate)) {
        if (!confirm('Esta data é um feriado brasileiro. Deseja continuar?')) {
            this.value = getNextBusinessDay(selectedDate).toISOString().split('T')[0];
            return;
        }
    }

    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (!confirm('Você está agendando para um fim de semana. Deseja continuar?')) {
            this.value = getNextWeekday(selectedDate).toISOString().split('T')[0];
        }
    }
    updateQuickDateIntel();
    renderQuickDayPreview();
});

function getNextBusinessDay(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d)) {
        d.setDate(d.getDate() + 1);
    }
    return d;
}

        // Máscara e Formatação Automática - Removido para type="date", pois usa yyyy-MM-dd

        // Calendário Visual (Datepicker) - Usando o input nativo, mas podemos melhorar
        // Para funcionalidades avançadas, manter o type="date"

        // Sugestões Contextuais
        // Removido: dateInput.addEventListener('focus', function() { showDateSuggestions(this); });
    }

function getNextWeekday(date) {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0) d.setDate(d.getDate() + 1); // Domingo -> Segunda
    else if (day === 6) d.setDate(d.getDate() + 2); // Sábado -> Segunda
    return d;
}

function showDateSuggestionsAgenda() {
    // Criar um dropdown com sugestões
    let suggestions = document.getElementById('date-suggestions-agenda');
    if (!suggestions) {
        suggestions = document.createElement('div');
        suggestions.id = 'date-suggestions-agenda';
        suggestions.className = 'absolute bg-white border border-gray-300 rounded-lg shadow-lg z-50 mt-1 w-full max-h-40 overflow-y-auto';
        document.getElementById('quick-event-date').parentNode.style.position = 'relative';
        document.getElementById('quick-event-date').parentNode.appendChild(suggestions);
    }

    const today = new Date();
    const suggestionsList = [
        { label: 'Hoje', date: today },
        { label: 'Amanhã', date: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
        { label: 'Próxima Segunda-feira', date: getNextMonday(today) },
        { label: 'Último dia útil do mês', date: getLastBusinessDayOfMonth(today) },
        { label: 'Daqui 3 dias', date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) },
        { label: 'Próxima semana', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
    ];

    suggestions.innerHTML = suggestionsList.map(s =>
        `<div class="p-2 hover:bg-gray-100 cursor-pointer" onclick="selectDateSuggestionAgenda('${s.date.toISOString().split('T')[0]}')">${s.label}</div>`
    ).join('');

    suggestions.style.display = 'block';

    // Adicionar event listener para fechar ao clicar fora
    const closeSuggestions = (e) => {
        if (!suggestions.contains(e.target) && e.target !== document.getElementById('quick-event-date').nextElementSibling) {
            suggestions.style.display = 'none';
            document.removeEventListener('click', closeSuggestions);
        }
    };
    document.addEventListener('click', closeSuggestions);
}

function selectDateSuggestionAgenda(dateStr) {
    document.getElementById('quick-event-date').value = dateStr;
    document.getElementById('date-suggestions-agenda').style.display = 'none';
    updateQuickDateIntel();
    renderQuickDayPreview();
}

function getNextMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 1 ? 7 : (8 - day) % 7;
    d.setDate(d.getDate() + diff);
    return d;
}

function getLastBusinessDayOfMonth(date) {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Último dia do mês
    while (d.getDay() === 0 || d.getDay() === 6) { // Se for fim de semana, voltar
        d.setDate(d.getDate() - 1);
    }
    return d;
}

// Validação de Intervalos
function validateTimeIntervals() {
    const startTime = document.getElementById('quick-event-time').value;
    const endTime = document.getElementById('quick-event-end-time').value;
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    const duration = (end - start) / (1000 * 60 * 60); // horas

    if (duration > 8) {
        alert('Eventos não podem durar mais de 8 horas.');
        return false;
    }

    if (start >= end) {
        alert('O horário de fim deve ser posterior ao horário de início.');
        return false;
    }

    // Verificar se está dentro do horário comercial (exemplo: 08:00 - 18:00)
    const startHour = start.getHours();
    const endHour = end.getHours();
    if (startHour < 8 || endHour > 18) {
        if (!confirm('O evento está fora do horário comercial (08:00-18:00). Deseja continuar?')) {
            return false;
        }
    }

    return true;
}

// Modificar handleQuickAddEvent para incluir validações
const originalHandleQuickAddEvent = handleQuickAddEvent;
window.handleQuickAddEvent = function(e) {
    if (!validateTimeIntervals()) {
        e.preventDefault();
        return;
    }
    originalHandleQuickAddEvent(e);
};
