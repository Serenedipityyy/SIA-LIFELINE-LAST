// --- GLOBAL CONSTANTS & STATE ---
const LS = {
    token: "lifeline_auth_token",
    user: "lifeline_user_data",
    section: "lifeline_active_section",
    alerts: "lifeline_alerts_muted",
    sidebar: "lifeline_sidebar_collapsed"
};

let state = {
    user: null,
    meta: {
        buildings: [],
        squads: [],
        zones: [],
        types: []
    },
    incidents: [],
    announcements: [],
    users: [],
    loginLogs: [],
    incidentLogs: [],
    selectedBuilding: null,
    selectedRoom: null,
    isMuted: localStorage.getItem(LS.alerts) === "true"
};

const POLL_MS = 4000;
let lastAlertCount = 0;
let activeAudioCtx = null;

// --- API HELPER ---
async function api(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(state.token ? { "Authorization": "Bearer " + state.token } : {}),
        ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
        body = JSON.stringify(body);
    }

    const res = await fetch(endpoint, {
        ...options,
        headers,
        body
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { error: text || "Invalid JSON response from server." };
    }

    if (!res.ok) {
        const errorObj = new Error(data.error || `HTTP error! status: ${res.status}`);
        errorObj.status = res.status;
        throw errorObj;
    }
    return data;
}

// --- AUTH UI & TAB SWITCHING ---
function switchAuthTab(tab) {
    const loginTabBtn = document.getElementById("loginTabBtn");
    const registerTabBtn = document.getElementById("registerTabBtn");
    const loginContainer = document.getElementById("loginFormContainer");
    const registerContainer = document.getElementById("registerFormContainer");

    if (!loginTabBtn || !registerTabBtn || !loginContainer || !registerContainer) return;

    if (tab === "login") {
        loginTabBtn.classList.add("active");
        registerTabBtn.classList.remove("active");
        loginContainer.style.display = "block";
        registerContainer.style.display = "none";
    } else {
        registerTabBtn.classList.add("active");
        loginTabBtn.classList.remove("active");
        registerContainer.style.display = "block";
        loginContainer.style.display = "none";
    }
}

// --- PROFILE & RENDER HELPERS ---
function renderProfile() {
    const u = state.user;
    if (!u) return;
    
    const userNameEl = document.getElementById("coderUserName") || document.getElementById("headerUserName");
    const userRoleEl = document.getElementById("aderUserRole") || document.getElementById("headerUserRole");
    const headerAvatar = document.getElementById("headerAvatar");

    if (userNameEl) userNameEl.textContent = u.name || u.studentId || "User";
    if (userRoleEl) userRoleEl.textContent = u.role ? u.role.toUpperCase() : "STUDENT";
    if (headerAvatar && u.name) {
        headerAvatar.textContent = u.name.charAt(0).toUpperCase();
    }
}

function renderRoleDashboard() {
    const u = state.user;
    if (!u) return;

    const r = u.role; // 'user', 'member', 'officer', 'admin'
    const studentView = document.getElementById("studentDashboardView");
    const medicView = document.getElementById("medicDashboardView");
    const officerView = document.getElementById("officerDashboardView");

    const badgeHeader = document.getElementById("roleBadgeHeader");
    const roleHeaderBadge = document.getElementById("roleHeaderBadge");
    const roleHeaderTitle = document.getElementById("roleHeaderTitle");
    const navDashText = document.getElementById("navDashText");

    if (badgeHeader) {
        if (r === "officer" || r === "admin") {
            badgeHeader.textContent = "OFFICER";
            badgeHeader.style.background = "#2563eb";
        } else if (r === "member") {
            badgeHeader.textContent = "MEDIC";
            badgeHeader.style.background = "#059669";
        } else {
            badgeHeader.textContent = "STUDENT";
            badgeHeader.style.background = "#4f46e5";
        }
    }

    if (roleHeaderBadge) roleHeaderBadge.textContent = r.toUpperCase();
    if (roleHeaderTitle) roleHeaderTitle.textContent = `Welcome back, ${u.name || 'User'}!`;
    if (navDashText) navDashText.textContent = r === 'user' ? 'Student Dashboard' : 'Responder Dashboard';

    if (studentView) studentView.style.display = "none";
    if (medicView) medicView.style.display = "none";
    if (officerView) officerView.style.display = "none";

    if (r === 'officer' || r === 'admin') {
        if (officerView) officerView.style.display = "block";
    } else if (r === 'member') {
        if (medicView) medicView.style.display = "block";
    } else {
        if (studentView) studentView.style.display = "block";
    }
}

function fillSelect(selectEl, items, defaultText = "Select option") {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${defaultText}</option>`;
    if (!items) return;
    items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id !== undefined ? item.id : (item.name || item);
        opt.textContent = item.name || item;
        selectEl.appendChild(opt);
    });
}

function updateRoomDropdown() {
    const buildingSelect = document.getElementById("building");
    const roomSelect = document.getElementById("room");
    if (!buildingSelect || !roomSelect) return;

    roomSelect.innerHTML = '<option value="">Select Room / Area</option>';
    const b = state.meta.buildings.find(x => String(x.id) === String(buildingSelect.value));
    if (b && b.rooms) {
        b.rooms.forEach(room => {
            const opt = document.createElement("option");
            opt.value = room.id;
            opt.textContent = room.name;
            roomSelect.appendChild(opt);
        });
    }
}

function renderSquadOverview() {}
async function pollTick() {}

// --- PROFILE DROPDOWN & UI HELPERS ---
function toggleProfileDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.classList.toggle("show");
}

function closeProfileDropdown() {
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.classList.remove("show");
}

document.addEventListener("click", function (event) {
    const container = document.getElementById("userProfileMenuContainer");
    if (container && !container.contains(event.target)) closeProfileDropdown();
});

// --- NAVIGATION & DASHBOARD CONTROLS ---
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.toggle("open");
}

function toggleSidebarCollapse() {
    const appLayout = document.getElementById("appLayout");
    if (appLayout) appLayout.classList.toggle("collapsed");
}

function showSection(sectionId, isInitialLoad = false) {
    localStorage.setItem(LS.section, sectionId);
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const activeNav = document.getElementById("nav-" + sectionId);
    if (activeNav) activeNav.classList.add("active");

    document.querySelectorAll(".dashboard-section").forEach(sec => sec.style.display = "none");
    const targetSec = document.getElementById("section-" + sectionId);
    if (targetSec) targetSec.style.display = "block";

    if (!isInitialLoad) closeProfileDropdown();
}

// --- MODALS & USER ACTIONS ---
function closeModal() {
    document.querySelectorAll(".modal, .custom-modal").forEach(m => m.style.display = "none");
}

function closeCodeModal() {
    const m = document.getElementById("codeModal");
    if (m) m.style.display = "none";
}

function openProfileEdit() {
    closeProfileDropdown();
    const m = document.getElementById("profileEditModal");
    if (m) m.style.display = "flex";
}

function closeProfileEdit() {
    const m = document.getElementById("profileEditModal");
    if (m) m.style.display = "none";
}

async function toggleSelfDuty() {
    if (!state.user) return;
    try {
        await api("roster.php?action=toggle_duty", { method: "POST", body: { student_id: state.user.studentId } });
        toast("Duty status updated.", "success");
    } catch (err) {
        toast(err.message, "error");
    }
}

function enableAlerts() {
    state.isMuted = false;
    localStorage.setItem(LS.alerts, "false");
    toast("Audio alerts enabled.", "success");
}

async function logout() {
    try { await api("auth.php?action=logout", { method: "POST" }); } catch (e) { /* ignore */ }
    localStorage.removeItem(LS.section);
    localStorage.removeItem(LS.token);
    window.location.replace("index.html");
}

// --- TOAST NOTIFICATIONS ---
function toast(message, type = "info", duration = 4000) {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container);
    }

    const el = document.createElement("div");
    let bg = "#2563eb";
    if (type === "success") bg = "#059669";
    if (type === "error") bg = "#dc2626";
    if (type === "warning") bg = "#d97706";

    el.style.cssText = `background: ${bg}; color: white; padding: 12px 18px; border-radius: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s ease;`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// --- OTP & REGISTRATION LOGIC ---
const ID_REGEX = /^\d{2}-\d{4}-\d{3}$/;
let isOtpVerified = false;

async function requestOTP() {
    const studentIdInput = document.getElementById("regStudentId");
    if (!studentIdInput) return;
    const studentId = studentIdInput.value.trim();

    if (!studentId || !ID_REGEX.test(studentId)) {
        toast("Please enter a valid Student ID format: 2X-XXXX-XXX (e.g. 23-1234-567).", "error");
        studentIdInput.focus();
        return;
    }

    const btn = document.getElementById("sendOtpBtn");
    if (btn) btn.disabled = true;

    try {
        const res = await api("auth.php?action=send_otp", {
            method: "POST",
            body: { student_id: studentId }
        });
        const otpSection = document.getElementById("otpCodeContainer") || document.getElementById("otpSection");
        if (otpSection) otpSection.style.display = "block";

        const statusMsg = document.getElementById("otpStatusMsg");
        if (statusMsg) {
            statusMsg.style.display = "block";
            statusMsg.textContent = res.message || "OTP sent successfully!";
        }

        toast(`OTP Sent! Demo code: ${res.demo_otp || 'Check console'}`, "success", 8000);
        if (res.demo_otp) console.log("DEMO OTP:", res.demo_otp);
    } catch (err) {
        toast(err.message || "Failed to send OTP.", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function verifyOTP() {
    const studentIdInput = document.getElementById("regStudentId");
    const otpInput = document.getElementById("regOtpCode");
    if (!studentIdInput || !otpInput) return;

    const student_id = studentIdInput.value.trim();
    const otp_code = otpInput.value.trim();

    if (!otp_code || otp_code.length !== 6) {
        toast("Please enter the 6-digit OTP code.", "error");
        otpInput.focus();
        return;
    }

    const btn = document.getElementById("verifyOtpBtn");
    if (btn) btn.disabled = true;

    try {
        const res = await api("auth.php?action=verify_otp", {
            method: "POST",
            body: { student_id, otp_code }
        });

        if (res.verified) {
            isOtpVerified = true;
            const verifiedMsg = document.getElementById("otpVerifiedMsg");
            if (verifiedMsg) verifiedMsg.style.display = "block";

            const submitBtn = document.getElementById("regSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
                submitBtn.style.cursor = "pointer";
            }
            if (btn) btn.style.display = "none";
            otpInput.disabled = true;
            studentIdInput.disabled = true;
            toast("OTP verified successfully! You may now complete your registration.", "success");
        }
    } catch (err) {
        toast(err.message || "Invalid or expired OTP code.", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// --- INITIALIZATION ---
async function startDashboard() {
    let me;
    try {
        me = await api("auth.php?action=me");
    } catch (err) {
        if (err.status !== 401) toast(err.message, "error", 8000);
        window.location.replace("index.html");
        return;
    }

    state.user = me.user;
    renderProfile();
    renderRoleDashboard();

    try {
        state.meta = await api("meta.php");
    } catch (err) {
        toast("Could not load campus data: " + err.message, "error", 8000);
    }

    fillSelect(document.getElementById("building"), state.meta.buildings, "Select Building");
    fillSelect(document.getElementById("incidentType"), state.meta.types, "Not sure / Other");
    fillSelect(document.getElementById("newMemberTeam"), state.meta.squads);
    fillSelect(document.getElementById("newMemberZone"), state.meta.zones);
    updateRoomDropdown();

    showSection(localStorage.getItem(LS.section) || "dashboard", true);
}

async function startLoginPage() {
    try {
        await api("auth.php?action=me");
        window.location.replace("dashboard.html");
    } catch (e) { /* stay on login */ }
}

function initApp() {
    if (document.getElementById("dashboard")) {
        startDashboard();
    } else {
        startLoginPage();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
