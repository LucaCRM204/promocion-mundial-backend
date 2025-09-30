// Configuración de la API
const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Headers para peticiones
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': authToken ? `Bearer ${authToken}` : ''
});

// ==================== MANEJO DE RESPUESTAS ====================

const handleApiResponse = async (response) => {
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la petición');
    }
    return response.json();
};

// ==================== UTILIDADES ====================

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function showLoading(button, show = true) {
    if (show) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="loading-spinner"></span> Cargando...';
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || 'Continuar';
        button.disabled = false;
    }
}

// ==================== NAVEGACIÓN ====================

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

// ==================== AUTENTICACIÓN ====================

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const loginBtn = document.getElementById('loginBtn');
    showLoading(loginBtn);
    
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await handleApiResponse(response);
        
        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
            showAlert('Login exitoso', 'success');
        }
        
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        showLoading(loginBtn, false);
    }
}

// Registro
async function handleRegister(e) {
    e.preventDefault();
    
    const registerBtn = document.getElementById('registerBtn');
    showLoading(registerBtn);
    
    try {
        const formData = {
            nombre: document.getElementById('nombre').value,
            apellido: document.getElementById('apellido').value,
            dni: document.getElementById('dni').value,
            email: document.getElementById('email').value,
            telefono: document.getElementById('telefono').value,
            plan: document.getElementById('plan').value,
            direccion: document.getElementById('direccion').value,
            localidad: document.getElementById('localidad').value,
            cp: document.getElementById('cp').value,
            password: document.getElementById('password').value
        };
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await handleApiResponse(response);
        
        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
            showAlert('Registro exitoso', 'success');
        }
        
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        showLoading(registerBtn, false);
    }
}

// Login demo
function demoLogin() {
    document.getElementById('loginEmail').value = 'demo@mundial2026.com';
    document.getElementById('loginPassword').value = 'demo123';
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

// Logout
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginSection').style.display = 'block';
    
    showAlert('Sesión cerrada', 'success');
}

// ==================== DASHBOARD ====================

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    
    document.getElementById('welcomeMessage').textContent = 
        `¡Bienvenido/a ${currentUser.nombre} ${currentUser.apellido}!`;
    
    loadBenefits();
    loadUserPrizes();
}

function loadBenefits() {
    const benefitsGrid = document.getElementById('benefitsGrid');
    const premios = [
        { cuota: 2, premio: '🧢 GORRA MUNDIAL 2026' },
        { cuota: 3, premio: '⚽ PELOTA FÚTBOL ALRA MUNDIAL' },
        { cuota: 4, premio: '💰 VOUCHER $1.000.000' },
        { cuota: 5, premio: '👕 CAMISETA ARGENTINA MUNDIAL 2026' },
        { cuota: 6, premio: '🚗 POLARIZADO' },
        { cuota: 7, premio: '🇦🇷 BANDERA ARGENTINA MUNDIAL 2026' },
        { cuota: 8, premio: '⛽ TANQUE LLENO DE NAFTA' },
        { cuota: 9, premio: '🏖️ VOUCHER VACACIONAL' }
    ];
    
    benefitsGrid.innerHTML = '';
    
    premios.forEach(item => {
        const card = document.createElement('div');
        card.className = 'benefit-card';
        card.setAttribute('data-cuota', item.cuota);
        
        card.innerHTML = `
            <div class="status-badge status-locked">Bloqueado</div>
            <h3>${item.cuota}° CUOTA PAGA</h3>
            <p>${item.premio}</p>
            
            <div class="upload-section">
                <div class="file-upload">
                    <input type="file" id="file-cuota-${item.cuota}" accept="image/*,.pdf" onchange="uploadFile(${item.cuota})">
                    <button class="upload-btn" onclick="document.getElementById('file-cuota-${item.cuota}').click()">
                        📄 Subir Comprobante
                    </button>
                </div>
                <div id="uploaded-cuota-${item.cuota}" class="uploaded-file"></div>
            </div>
        `;
        
        benefitsGrid.appendChild(card);
    });
}

// ==================== COMPROBANTES ====================

async function uploadFile(cuotaNumber) {
    const fileInput = document.getElementById(`file-cuota-${cuotaNumber}`);
    const file = fileInput.files[0];
    
    if (!file) return;
    
    // Validar archivo
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showAlert('El archivo es demasiado grande (máximo 10MB)', 'error');
        return;
    }
    
    const uploadBtn = fileInput.nextElementSibling;
    showLoading(uploadBtn);
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('cuota_number', cuotaNumber);
        
        const response = await fetch(`${API_URL}/comprobantes/upload`, {
            method: 'POST',
            headers: {
                'Authorization': authToken ? `Bearer ${authToken}` : ''
            },
            body: formData
        });
        
        const result = await handleApiResponse(response);
        
        if (result.success) {
            updateCardStatus(cuotaNumber, 'pending');
            
            const uploadedDiv = document.getElementById(`uploaded-cuota-${cuotaNumber}`);
            uploadedDiv.innerHTML = `📎 ${file.name} - <span style="color: #f39c12;">Pendiente validación</span>`;
            uploadedDiv.style.display = 'block';
            
            showAlert('Comprobante subido exitosamente', 'success');
        }
        
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        showLoading(uploadBtn, false);
    }
}

function updateCardStatus(cuotaNumber, status) {
    const card = document.querySelector(`[data-cuota="${cuotaNumber}"]`);
    if (!card) return;
    
    const badge = card.querySelector('.status-badge');
    
    card.classList.remove('pending', 'validated');
    badge.classList.remove('status-locked', 'status-pending', 'status-validated');
    
    if (status === 'pending') {
        card.classList.add('pending');
        badge.classList.add('status-pending');
        badge.textContent = 'Pendiente Validación';
    } else if (status === 'validated') {
        card.classList.add('validated');
        badge.classList.add('status-validated');
        badge.textContent = '¡GANASTE!';
        card.addEventListener('click', () => triggerCelebration(cuotaNumber));
    }
}

// ==================== PREMIOS ====================

async function loadUserPrizes() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/premios/user/${currentUser.id}`, {
            headers: getHeaders()
        });
        
        const result = await handleApiResponse(response);
        
        if (result.success) {
            result.premios.forEach(premio => {
                updateCardStatus(premio.cuota_number, premio.status === 'ready' ? 'validated' : premio.status);
            });
        }
        
    } catch (error) {
        console.error('Error cargando premios:', error);
    }
}

// ==================== CELEBRACIONES ====================

function triggerCelebration(cuotaNumber) {
    const celebration = document.getElementById('golCelebration');
    const golText = document.getElementById('golText');
    
    golText.textContent = `¡GOOOOOOOL!\n🎉 PREMIO ${cuotaNumber} 🎉\n🇦🇷 ¡VAMOS ARGENTINA! 🇦🇷`;
    
    celebration.style.display = 'block';
    
    setTimeout(() => {
        celebration.style.display = 'none';
    }, 3000);
}

// ==================== INICIALIZACIÓN ====================

window.addEventListener('load', () => {
    // Event listeners para formularios
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Verificar sesión existente
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        authToken = savedToken;
        showDashboard();
    }
});

// Exportar funciones globales
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.demoLogin = demoLogin;
window.logout = logout;
window.uploadFile = uploadFile;