// Global Variables
let currentUser = null;
let authToken = null;
let memories = [];
let currentPage = 1;
let totalPages = 1;

// API Base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Google Client ID — loaded from backend or set manually
// IMPORTANT: Replace this with your actual Google Client ID
const GOOGLE_CLIENT_ID = 'YOUR_ACTUAL_GOOGLE_CLIENT_ID_HERE';

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});


function initializeApp() {
    setupEventListeners();
    checkAuthStatus();
    initializeVoiceRecognition();
    loadTheme();
    initializeGoogleSignIn();
}

// ==========================================
// Google Sign-In Integration
// ==========================================

/**
 * Initialize Google Sign-In button on login/register pages.
 * The GSI library must be loaded via <script> in the HTML.
 */
function initializeGoogleSignIn() {
    // Only initialize if the Google GSI library is loaded and we're on an auth page
    const googleButtonContainer = document.getElementById('googleSignInButton');
    if (!googleButtonContainer) return;

    // Wait for the Google GSI library to load (it's loaded async)
    if (typeof google === 'undefined' || !google.accounts) {
        // Retry after a short delay if GSI hasn't loaded yet
        setTimeout(initializeGoogleSignIn, 200);
        return;
    }

    try {
        // Initialize Google Sign-In
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Render the Google Sign-In button
        google.accounts.id.renderButton(
            googleButtonContainer,
            {
                theme: 'outline',
                size: 'large',
                width: googleButtonContainer.offsetWidth || 350,
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        );

        console.log('Google Sign-In initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Google Sign-In:', error);
    }
}

/**
 * Handle the Google Sign-In callback.
 * Called automatically by Google GSI after the user selects an account.
 * @param {Object} response - Google credential response containing the ID token
 */
async function handleGoogleSignIn(response) {
    console.log('Google Sign-In callback received');
    
    if (!response || !response.credential) {
        showError('Google Sign-In failed. Please try again.');
        return;
    }

    showLoading();

    try {
        // Send the Google credential (ID token) to our backend for verification
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                credential: response.credential
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Store auth data
            authToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            showSuccess('Signed in with Google successfully!');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            showError(data.error || 'Google authentication failed. Please try again.');
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        showError('Network error during Google Sign-In. Please check your connection and try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Update the user avatar on the dashboard to show Google profile picture.
 */
function updateUserAvatar() {
    const avatarEl = document.getElementById('userAvatar');
    if (!avatarEl || !currentUser) return;

    if (currentUser.picture) {
        avatarEl.innerHTML = `<img src="${currentUser.picture}" alt="${currentUser.name || 'User'}" referrerpolicy="no-referrer">`;
    } else {
        avatarEl.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function closeModal() {
    const modal = document.getElementById('memoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function logout() {
    // Revoke Google session if the GSI library is loaded
    try {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
    } catch (e) {
        console.log('Google sign-out cleanup (non-critical):', e);
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    window.location.href = 'index.html';
}

function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
}

async function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    await loadMemories(1, searchTerm);
}

async function handleFilter() {
    await loadMemories(1);
}

async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        
        // If on auth pages, redirect to dashboard
        if (['index.html', 'login.html', 'register.html'].includes(currentPage)) {
            window.location.href = 'dashboard.html';
        } else if (currentPage === 'dashboard.html') {
            // Load dashboard data
            document.getElementById('userName').textContent = currentUser.name || currentUser.email;
            const displayNameEl = document.getElementById('userDisplayName');
            if (displayNameEl) {
                displayNameEl.textContent = currentUser.name || currentUser.email;
            }
            updateUserAvatar();
            await loadMemories();
            loadStats();
            renderCalendar();
        }
    } else {
        // If not logged in and on dashboard, redirect to index
        if (currentPage === 'dashboard.html') {
            window.location.href = 'index.html';
        }
    }
}

async function loadMemories(page = 1, search = '') {
    try {
        showLoading();
        
        const category = document.getElementById('categoryFilter')?.value || '';
        const mood = document.getElementById('moodFilter')?.value || '';
        
        let url = `${API_BASE_URL}/memories?page=${page}&per_page=10`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;
        if (mood) url += `&mood=${encodeURIComponent(mood)}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            memories = data.memories;
            currentPage = data.pagination.page;
            totalPages = data.pagination.pages;
            
            renderMemories();
            renderPagination();
        } else {
            showError(data.error || 'Failed to load memories');
        }
    } catch (error) {
        console.error('Load memories error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function renderMemories() {
    const memoriesList = document.getElementById('recentMemoriesList');
    if (!memoriesList) return;
    
    if (memories.length === 0) {
        memoriesList.innerHTML = '<p class="no-memories">No memories found. Create your first memory!</p>';
        return;
    }
    
    memoriesList.innerHTML = memories.map(memory => `
        <div class="memory-card mood-${memory.mood}" onclick="viewMemory('${memory.id}')">
            <div class="memory-header">
                <h3>${memory.title}</h3>
                <span class="memory-date">${formatDate(memory.date)}</span>
            </div>
            <p class="memory-description">${memory.description.substring(0, 150)}${memory.description.length > 150 ? '...' : ''}</p>
            <div class="memory-footer">
                <span class="memory-category">${memory.category}</span>
                <span class="memory-mood">${memory.mood}</span>
            </div>
        </div>
    `).join('');
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button onclick="loadMemories(${currentPage - 1})" class="btn btn-secondary">Previous</button>`;
    }
    
    // Page numbers
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        const active = i === currentPage ? 'active' : '';
        html += `<button onclick="loadMemories(${i})" class="btn ${active}">${i}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button onclick="loadMemories(${currentPage + 1})" class="btn btn-secondary">Next</button>`;
    }
    
    pagination.innerHTML = html;
}

function viewMemory(memoryId) {
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return;
    
    const modal = document.getElementById('memoryModal');
    const modalBody = document.getElementById('modalBody');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <h2>${memory.title}</h2>
            <p><strong>Date:</strong> ${formatDate(memory.date)}</p>
            <p><strong>Category:</strong> ${memory.category}</p>
            <p><strong>Mood:</strong> ${memory.mood}</p>
            <p><strong>Description:</strong></p>
            <p>${memory.description}</p>
            ${memory.tags && memory.tags.length > 0 ? `
                <p><strong>Tags:</strong> ${memory.tags.join(', ')}</p>
            ` : ''}
            <div class="modal-actions">
                <button onclick="editMemory('${memory.id}')" class="btn btn-secondary">Edit</button>
                <button onclick="deleteMemory('${memory.id}')" class="btn btn-danger">Delete</button>
            </div>
        `;
        
        modal.style.display = 'block';
    }
}

async function handleMemorySubmit(e) {
    e.preventDefault();
    showLoading();
    
    const title = document.getElementById('memoryTitle').value.trim();
    const description = document.getElementById('memoryDescription').value.trim();
    const mood = document.getElementById('memoryMood').value;
    const category = document.getElementById('memoryCategory').value;
    const tags = document.getElementById('memoryTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const date = document.getElementById('memoryDate').value || new Date().toISOString();
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title,
                description,
                mood,
                category,
                tags,
                date
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Memory created successfully!');
            document.getElementById('memoryForm').reset();
            
            // Clear voice-filled flags
            ['memoryTitle', 'memoryDescription', 'memoryTags'].forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.dataset.voiceFilled = 'false';
                }
            });
            
            await loadMemories();
        } else {
            showError(data.error || 'Failed to create memory');
        }
    } catch (error) {
        console.error('Create memory error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

async function deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories/${memoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showSuccess('Memory deleted successfully!');
            closeModal();
            await loadMemories();
        } else {
            const data = await response.json();
            showError(data.error || 'Failed to delete memory');
        }
    } catch (error) {
        console.error('Delete memory error:', error);
        showError('Network error. Please try again.');
    }
}

async function editMemory(memoryId) {
    // For now, just show the memory details
    // In a full implementation, this would open an edit form
    viewMemory(memoryId);
}

// Theme Management
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Event Listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            console.log('Auth tab clicked:', this.dataset.tab);
            switchAuthTab(this.dataset.tab);
        });
    });

    // Auth forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        console.log('Login form found, adding event listener');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error('Login form not found');
    }
    
    if (registerForm) {
        console.log('Register form found, adding event listener');
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.error('Register form not found');
    }

    // Memory form
    const memoryForm = document.getElementById('memoryForm');
    if (memoryForm) {
        memoryForm.addEventListener('submit', handleMemorySubmit);
    }

    // Voice toggle
    const voiceToggle = document.getElementById('voiceToggle');
    if (voiceToggle) {
        voiceToggle.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Voice toggle clicked');
            toggleVoiceAssistant();
        });
    }
    
    // Voice query button
    const voiceQueryBtn = document.getElementById('voiceQueryBtn');
    if (voiceQueryBtn) {
        voiceQueryBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Voice query button clicked');
            toggleVoiceQuery();
        });
    }
    
    // Ask button
    const askBtn = document.getElementById('askBtn');
    if (askBtn) {
        askBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Ask button clicked');
            handleTextQuery();
        });
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Dark mode toggle clicked');
            toggleTheme();
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Logout button clicked');
            logout();
        });
    }

    // Search and filters
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 500));
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleFilter);
    }
    
    const moodFilter = document.getElementById('moodFilter');
    if (moodFilter) {
        moodFilter.addEventListener('change', handleFilter);
    }

    // Modal
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('memoryModal');
        if (modal && event.target === modal) {
            closeModal();
        }
    });
    
    // Clear voice-filled data when user manually edits form fields
    ['memoryTitle', 'memoryDescription', 'memoryTags'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                this.dataset.voiceFilled = 'false';
            });
        }
    });
}

// Authentication
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Form`).classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Login function called');
    showLoading();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    console.log('Login data:', { email, password: '***' });
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);
        const data = await response.json();
        console.log('Login response data:', data);
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            window.location.href = 'dashboard.html';
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Register function called');
    showLoading();
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const name = `${firstName} ${lastName}`.trim();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    console.log('Register data:', { name, email, password: '***' });
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        console.log('Register response status:', response.status);
        const data = await response.json();
        console.log('Register response data:', data);
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            window.location.href = 'dashboard.html';
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Register error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        showDashboard();
        loadMemories();
        loadStats();
        renderCalendar();
    }
}

function showDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name || currentUser.email;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
    
    // Reset forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

// Memory Management
async function handleMemorySubmit(e) {
    e.preventDefault();
    showLoading();
    
    const title = document.getElementById('memoryTitle').value;
    const description = document.getElementById('memoryDescription').value;
    const date = document.getElementById('memoryDate').value || new Date().toISOString().split('T')[0];
    const mood = document.getElementById('memoryMood').value;
    const category = document.getElementById('memoryCategory').value;
    const tags = document.getElementById('memoryTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const imageFile = document.getElementById('memoryImage').files[0];
    
    let imageUrl = null;
    
    // Upload image if provided
    if (imageFile) {
        imageUrl = await uploadImage(imageFile);
    }
    
    try {
        const memoryData = {
            title,
            description,
            date,
            mood,
            category,
            tags,
            image_url: imageUrl
        };
        
        const response = await fetch(`${API_BASE_URL}/memories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(memoryData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Memory created successfully!');
            document.getElementById('memoryForm').reset();
            loadMemories();
            loadStats();
            renderCalendar();
        } else {
            showError(data.error || 'Failed to create memory');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return data.file_url;
        }
    } catch (error) {
        console.error('Image upload failed:', error);
    }
    
    return null;
}

async function loadMemories(page = 1, search = '', category = '', mood = '') {
    showLoading();
    
    const params = new URLSearchParams({
        page: page.toString(),
        limit: '9'
    });
    
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (mood) params.append('mood', mood);
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            memories = data.memories;
            currentPage = data.pagination.page;
            totalPages = data.pagination.pages;
            renderMemories();
            renderPagination();
        } else {
            showError(data.error || 'Failed to load memories');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function renderMemories() {
    const container = document.getElementById('memoriesList');
    
    if (memories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No memories found. Create your first memory!</p>';
        return;
    }
    
    container.innerHTML = memories.map(memory => `
        <div class="memory-card mood-${memory.mood}" onclick="showMemoryDetails('${memory._id}')">
            <div class="memory-header">
                <div>
                    <div class="memory-title">${memory.title}</div>
                    <div class="memory-date">${formatDate(memory.date)}</div>
                </div>
                <div class="memory-actions">
                    <button onclick="event.stopPropagation(); editMemory('${memory._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteMemory('${memory._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="memory-description">${memory.description}</div>
            ${memory.image_url ? `<img src="${memory.image_url}" alt="${memory.title}" style="width: 100%; border-radius: 0.5rem; margin-bottom: 1rem;">` : ''}
            <div class="memory-meta">
                <span class="memory-category">${memory.category}</span>
                <div class="memory-tags">
                    ${memory.tags.map(tag => `<span class="memory-tag">${tag}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
    
    // Update calendar after memories are rendered
    renderCalendar();
}

function renderPagination() {
    const container = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button onclick="loadMemories(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `<button onclick="loadMemories(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += '<span>...</span>';
        }
    }
    
    // Next button
    paginationHTML += `<button onclick="loadMemories(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    container.innerHTML = paginationHTML;
}

async function showMemoryDetails(memoryId) {
    try {
        const response = await fetch(`${API_BASE_URL}/memories/${memoryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const memory = data.memory;
            const modalBody = document.getElementById('modalBody');
            
            modalBody.innerHTML = `
                <h2>${memory.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">${formatDate(memory.date)}</p>
                ${memory.image_url ? `<img src="${memory.image_url}" alt="${memory.title}" style="width: 100%; border-radius: 0.5rem; margin-bottom: 1rem;">` : ''}
                <p style="line-height: 1.6; margin-bottom: 1rem;">${memory.description}</p>
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <span class="memory-category">${memory.category}</span>
                    <span style="background: var(--mood-${memory.mood}); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem;">${memory.mood}</span>
                </div>
                <div class="memory-tags">
                    ${memory.tags.map(tag => `<span class="memory-tag">${tag}</span>`).join('')}
                </div>
            `;
            
            document.getElementById('memoryModal').style.display = 'block';
        } else {
            showError(data.error || 'Failed to load memory');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    }
}

function closeModal() {
    document.getElementById('memoryModal').style.display = 'none';
}

async function deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories/${memoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Memory deleted successfully!');
            loadMemories();
            loadStats();
            renderCalendar();
        } else {
            showError(data.error || 'Failed to delete memory');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

// Search and Filter
function handleSearch(e) {
    const searchTerm = e.target.value;
    loadMemories(currentPage, searchTerm, getCategoryFilter(), getMoodFilter());
}

function handleFilter() {
    loadMemories(currentPage, getSearchTerm(), getCategoryFilter(), getMoodFilter());
}

function getSearchTerm() {
    return document.getElementById('searchInput').value;
}

function getCategoryFilter() {
    return document.getElementById('categoryFilter').value;
}

function getMoodFilter() {
    return document.getElementById('moodFilter').value;
}

function playClickSound() {
    // Create a click sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800 Hz beep
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// Voice Assistant Functions
function toggleVoiceAssistant() {
    if (isListening) {
        stopVoiceAssistant();
    } else {
        startVoiceAssistant();
    }
}

function startVoiceAssistant() {
    console.log('Starting voice assistant...');
    
    if (!voiceRecognition) {
        console.error('Voice recognition not initialized');
        showError('Voice recognition not supported');
        return;
    }
    
    if (isListening) {
        console.log('Voice recognition already running');
        return;
    }
    
    isListening = true;
    currentTranscript = ''; // Reset transcript
    
    try {
        voiceRecognition.start();
        console.log('Voice recognition started successfully');
        
        const voiceToggle = document.getElementById('voiceToggle');
        const voiceAssistant = document.getElementById('voiceAssistant');
        const transcriptText = document.getElementById('transcriptText');
        const voiceStatusText = document.getElementById('voiceStatusText');
        
        if (voiceToggle) voiceToggle.classList.add('active');
        if (voiceAssistant) voiceAssistant.classList.add('active');
        if (transcriptText) transcriptText.classList.add('recording');
        if (voiceStatusText) voiceStatusText.textContent = 'Listening... Speak naturally';
        
        // Play start sound
        playClickSound();
    } catch (error) {
        console.error('Failed to start voice recognition:', error);
        isListening = false;
        showError('Failed to start voice recognition');
    }
}

function stopVoiceAssistant() {
    isListening = false;
    
    if (voiceRecognition) {
        voiceRecognition.stop();
    }
    
    const voiceToggle = document.getElementById('voiceToggle');
    const voiceAssistant = document.getElementById('voiceAssistant');
    const transcriptText = document.getElementById('transcriptText');
    const voiceStatusText = document.getElementById('voiceStatusText');
    
    if (voiceToggle) voiceToggle.classList.remove('active');
    if (voiceAssistant) voiceAssistant.classList.remove('active');
    if (transcriptText) transcriptText.classList.remove('recording');
    if (voiceStatusText) voiceStatusText.textContent = 'Click to start voice recording';
}

function toggleVoiceQuery() {
    if (isListening) {
        stopVoiceAssistant();
        const voiceStatusText = document.getElementById('voiceStatusText');
        if (voiceStatusText) voiceStatusText.textContent = 'Voice query stopped';
    } else {
        startVoiceAssistant();
        const voiceStatusText = document.getElementById('voiceStatusText');
        if (voiceStatusText) voiceStatusText.textContent = 'Listening for your query...';
    }
}

function handleTextQuery() {
    const queryInput = document.getElementById('aiQuery');
    if (!queryInput) return;
    
    const query = queryInput.value.trim();
    if (!query) {
        showError('Please enter a query');
        return;
    }
    
    console.log('Text query:', query);
    queryMemories(query);
}

async function queryMemories(query) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayQueryResponse(data.response, data.memories);
        } else {
            showError(data.error || 'Query failed');
        }
    } catch (error) {
        console.error('Query error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function displayQueryResponse(response, memories) {
    const queryResponse = document.getElementById('queryResponse');
    if (!queryResponse) return;
    
    let html = `
        <h3>${response}</h3>
        <p>Found ${memories.length} matching memories:</p>
    `;
    
    if (memories.length > 0) {
        html += '<div class="memory-list">';
        memories.forEach(memory => {
            html += `
                <div class="memory-item mood-${memory.mood}">
                    <strong>${memory.title}</strong> - ${formatDate(memory.date)}
                    <p>${memory.description.substring(0, 100)}${memory.description.length > 100 ? '...' : ''}</p>
                    <div style="margin-top: 0.5rem;">
                        <span class="memory-category">${memory.category}</span>
                        <span style="background: var(--mood-${memory.mood}); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem; margin-left: 0.5rem;">${memory.mood}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    queryResponse.innerHTML = html;
    queryResponse.classList.add('show');
}

// Voice Assistant
let currentTranscript = '';

function initializeVoiceRecognition() {
    console.log('Initializing voice recognition...');
    
    // Check network connectivity first
    checkNetworkConnectivity().then(isConnected => {
        if (!isConnected) {
            console.warn('Network connectivity issues detected');
            const voiceStatusText = document.getElementById('voiceStatusText');
            if (voiceStatusText) {
                voiceStatusText.textContent = 'Network issues detected. Voice recognition may be limited.';
            }
            return;
        }
        
        initializeVoiceRecognitionService();
    });
}

async function checkNetworkConnectivity() {
    try {
        // Check if backend is reachable
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            timeout: 5000
        });
        return response.ok;
    } catch (error) {
        console.warn('Network check failed:', error);
        return false;
    }
}

function initializeVoiceRecognitionService() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        const voiceStatusText = document.getElementById('voiceStatusText');
        const voiceToggle = document.getElementById('voiceToggle');
        const voiceQueryBtn = document.getElementById('voiceQueryBtn');
        if (voiceStatusText) voiceStatusText.textContent = 'Voice recognition not supported in this browser';
        if (voiceToggle) voiceToggle.style.display = 'none';
        if (voiceQueryBtn) voiceQueryBtn.style.display = 'none';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = 'en-US';
    
    voiceRecognition.onstart = function() {
        console.log('Voice recognition started');
        isListening = true;
    };
    
    voiceRecognition.onend = function() {
        console.log('Voice recognition ended');
        isListening = false;
        // Only restart if we're supposed to be listening and no error occurred
        if (isListening && !voiceRecognition.lastError) {
            setTimeout(() => {
                if (voiceRecognition && isListening) {
                    voiceRecognition.start();
                }
            }, 100);
        }
    };
    
    voiceRecognition.onresult = function(event) {
        console.log('Voice recognition result:', event);
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log('Transcript:', transcript);
            
            if (event.results[i].isFinal) {
                currentTranscript += transcript + ' ';
                console.log('Final transcript:', currentTranscript);
                
                // Update live transcription display
                updateLiveTranscription(currentTranscript);
                
                // Extract and display information in real-time
                const extractedInfo = processVoiceText(currentTranscript);
                updateExtractedInfo(extractedInfo);
                
                // Auto-populate form fields
                autoPopulateForm(extractedInfo);
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Show interim results
        const displayText = currentTranscript + interimTranscript;
        const transcriptElement = document.getElementById('transcriptText');
        if (transcriptElement) {
            transcriptElement.textContent = displayText;
            transcriptElement.scrollTop = transcriptElement.scrollHeight;
        }
    };
    
    voiceRecognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        voiceRecognition.lastError = event.error; // Track last error
        
        const voiceStatusText = document.getElementById('voiceStatusText');
        if (voiceStatusText) {
            switch(event.error) {
                case 'not-allowed':
                    voiceStatusText.textContent = 'Microphone access denied. Please allow microphone access.';
                    showNotification('Please allow microphone access to use voice assistant', 'error');
                    break;
                case 'no-speech':
                    voiceStatusText.textContent = 'No speech detected. Please try again.';
                    break;
                case 'network':
                    voiceStatusText.textContent = 'Network error. Retrying...';
                    showNotification('Network error. Attempting to reconnect...', 'error');
                    // Auto-retry after 2 seconds
                    setTimeout(() => {
                        if (isListening && voiceRecognition) {
                            try {
                                voiceRecognition.start();
                                console.log('Retrying voice recognition after network error');
                                voiceRecognition.lastError = null; // Clear error on retry
                            } catch (retryError) {
                                console.error('Retry failed:', retryError);
                                voiceStatusText.textContent = 'Voice recognition failed. Please refresh the page.';
                            }
                        }
                    }, 2000);
                    break;
                case 'service-not-allowed':
                    voiceStatusText.textContent = 'Voice recognition service not allowed. Please check browser settings.';
                    showNotification('Voice recognition service blocked by browser', 'error');
                    break;
                case 'audio-capture':
                    voiceStatusText.textContent = 'Audio capture error. Please check microphone settings.';
                    showNotification('Microphone hardware error', 'error');
                    break;
                default:
                    voiceStatusText.textContent = `Voice recognition error: ${event.error}`;
                    showNotification(`Voice error: ${event.error}`, 'error');
            }
        }
        
        // Stop on critical errors
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isListening = false;
            const voiceToggle = document.getElementById('voiceToggle');
            if (voiceToggle) voiceToggle.classList.remove('active');
        }
    };
    
    console.log('Voice recognition initialized successfully');
}

function updateLiveTranscription(text) {
    const transcriptElement = document.getElementById('transcriptText');
    transcriptElement.textContent = text;
    transcriptElement.scrollTop = transcriptElement.scrollHeight;
}

function updateExtractedInfo(info) {
    document.getElementById('extractedTitle').textContent = info.title || '-';
    document.getElementById('extractedMood').textContent = info.mood || '-';
    document.getElementById('extractedCategory').textContent = info.category || '-';
    document.getElementById('extractedTags').textContent = info.tags ? info.tags.join(', ') : '-';
    
    // Update mood indicator color
    const moodElement = document.getElementById('extractedMood').parentElement;
    moodElement.className = 'info-item mood-' + (info.mood || 'neutral');
}

function autoPopulateForm(info) {
    // Only populate if fields are empty or user hasn't modified them
    if (!document.getElementById('memoryTitle').value || document.getElementById('memoryTitle').dataset.voiceFilled !== 'true') {
        document.getElementById('memoryTitle').value = info.title || '';
        document.getElementById('memoryTitle').dataset.voiceFilled = 'true';
    }
    
    if (!document.getElementById('memoryDescription').value || document.getElementById('memoryDescription').dataset.voiceFilled !== 'true') {
        document.getElementById('memoryDescription').value = info.description || '';
        document.getElementById('memoryDescription').dataset.voiceFilled = 'true';
    }
    
    if (document.getElementById('memoryMood').value === 'neutral') {
        document.getElementById('memoryMood').value = info.mood || 'neutral';
    }
    
    if (document.getElementById('memoryCategory').value === 'general') {
        document.getElementById('memoryCategory').value = info.category || 'general';
    }
    
    if (!document.getElementById('memoryTags').value || document.getElementById('memoryTags').dataset.voiceFilled !== 'true') {
        document.getElementById('memoryTags').value = info.tags ? info.tags.join(', ') : '';
        document.getElementById('memoryTags').dataset.voiceFilled = 'true';
    }
}

function processVoiceText(text) {
    // Basic text processing for demonstration
    // In production, this would call the backend API
    const processed = {
        title: extractTitle(text),
        description: text,
        mood: detectMood(text),
        category: detectCategory(text),
        tags: extractTags(text)
    };
    
    return processed;
}

function extractTitle(text) {
    // Extract first sentence or key phrase as title
    const sentences = text.split(/[.!?]+/);
    if (sentences.length > 0 && sentences[0].trim().length > 0) {
        let title = sentences[0].trim();
        if (title.length > 100) {
            title = title.substring(0, 100) + '...';
        }
        return title;
    }
    
    // If no clear sentences, use first 50 characters
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
}

function detectMood(text) {
    const textLower = text.toLowerCase();
    
    // Simple mood detection based on keywords
    const moodKeywords = {
        'happy': ['happy', 'joy', 'excited', 'wonderful', 'amazing', 'great', 'fantastic', 'love', 'excellent'],
        'sad': ['sad', 'unhappy', 'depressed', 'disappointed', 'terrible', 'awful', 'bad', 'hate'],
        'angry': ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'upset', 'irritated'],
        'excited': ['excited', 'thrilled', 'enthusiastic', 'eager', 'looking forward', 'can\'t wait'],
        'peaceful': ['peaceful', 'calm', 'relaxed', 'serene', 'tranquil', 'quiet', 'peace'],
        'love': ['love', 'adore', 'cherish', 'care for', 'affection', 'romantic', 'relationship']
    };
    
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
        for (const keyword of keywords) {
            if (textLower.includes(keyword)) {
                return mood;
            }
        }
    }
    
    return 'neutral';
}

function detectCategory(text) {
    const textLower = text.toLowerCase();
    
    // Category detection based on keywords
    const categoryKeywords = {
        'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline', 'boss', 'colleague', 'team', 'client', 'business'],
        'family': ['family', 'mom', 'dad', 'brother', 'sister', 'parent', 'child', 'home', 'dinner', 'together', 'relative'],
        'travel': ['travel', 'trip', 'vacation', 'holiday', 'flight', 'hotel', 'beach', 'mountain', 'city', 'country', 'airport'],
        'food': ['food', 'eat', 'restaurant', 'dinner', 'lunch', 'breakfast', 'meal', 'cooking', 'recipe', 'delicious', 'tasty'],
        'health': ['health', 'exercise', 'gym', 'doctor', 'medicine', 'workout', 'fitness', 'diet', 'weight', 'running'],
        'education': ['study', 'learn', 'class', 'course', 'school', 'university', 'exam', 'book', 'knowledge', 'reading'],
        'hobby': ['hobby', 'music', 'movie', 'game', 'sport', 'art', 'painting', 'reading', 'writing', 'playing'],
        'social': ['friend', 'party', 'social', 'gathering', 'event', 'celebration', 'birthday', 'wedding', 'together']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (textLower.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'general';
}

function extractTags(text) {
    // Simple tag extraction - in production, use NLP
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'];
    
    const tags = words
        .filter(word => word.length > 2 && !stopWords.includes(word))
        .filter((word, index, self) => self.indexOf(word) === index) // Remove duplicates
        .slice(0, 5); // Limit to 5 tags
    
    return tags;
}

function populateFormFromVoice(transcript) {
    // Extract information from voice and populate form in real-time
    const processed = processVoiceText(transcript);
    
    // Update form fields in real-time
    if (processed.title && !document.getElementById('memoryTitle').value) {
        document.getElementById('memoryTitle').value = processed.title;
    }
    
    if (processed.description && !document.getElementById('memoryDescription').value) {
        document.getElementById('memoryDescription').value = processed.description;
    }
    
    if (processed.mood && document.getElementById('memoryMood').value === 'neutral') {
        document.getElementById('memoryMood').value = processed.mood;
    }
    
    if (processed.category && document.getElementById('memoryCategory').value === 'general') {
        document.getElementById('memoryCategory').value = processed.category;
    }
    
    if (processed.tags && processed.tags.length > 0) {
        const existingTags = document.getElementById('memoryTags').value;
        if (!existingTags) {
            document.getElementById('memoryTags').value = processed.tags.join(', ');
        }
    }
    
    // Show real-time feedback
    showVoiceFeedback(`Creating memory: ${processed.title || 'Untitled'}`);
}

function showVoiceFeedback(message) {
    const voiceResponse = document.getElementById('voiceResponse');
    voiceResponse.textContent = message;
    voiceResponse.classList.add('show');
    
    // Text-to-speech for feedback
    speakText(message);
    
    // Hide after 3 seconds
    setTimeout(() => {
        voiceResponse.classList.remove('show');
    }, 3000);
}

function processVoiceQuery(transcript) {
    console.log('Processing voice query:', transcript);
    showVoiceFeedback('Searching your memories...');
    
    // Call the query API
    queryMemories(transcript);
}

async function queryMemories(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayQueryResponse(data.response, data.memories);
            speakText(data.response);
        } else {
            showError(data.error || 'Query failed');
        }
    } catch (error) {
        console.error('Query error:', error);
        showError('Network error. Please try again.');
    }
}

function displayQueryResponse(response, memories) {
    const queryResponse = document.getElementById('queryResponse');
    
    let html = `
        <h3>${response}</h3>
        <p>Found ${memories.length} matching memories:</p>
    `;
    
    if (memories.length > 0) {
        html += '<div class="memory-list">';
        memories.forEach(memory => {
            html += `
                <div class="memory-item mood-${memory.mood}">
                    <strong>${memory.title}</strong> - ${formatDate(memory.date)}
                    <p>${memory.description.substring(0, 100)}${memory.description.length > 100 ? '...' : ''}</p>
                    <div style="margin-top: 0.5rem;">
                        <span class="memory-category">${memory.category}</span>
                        <span style="background: var(--mood-${memory.mood}); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem; margin-left: 0.5rem;">${memory.mood}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    queryResponse.innerHTML = html;
    queryResponse.classList.add('show');
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-speech not supported');
    }
}

function toggleVoiceQuery() {
    if (isListening) {
        stopVoiceAssistant();
        document.getElementById('voiceStatusText').textContent = 'Voice query stopped';
    } else {
        startVoiceAssistant();
        document.getElementById('voiceStatusText').textContent = 'Listening for your query...';
    }
}

function handleTextQuery() {
    const query = document.getElementById('aiQuery').value.trim();
    if (!query) {
        showError('Please enter a query');
        return;
    }
    
    console.log('Text query:', query);
    queryMemories(query);
}

function startVoiceAssistant() {
    if (!voiceRecognition) {
        showError('Voice recognition not supported');
        return;
    }
    
    isListening = true;
    currentTranscript = ''; // Reset transcript
    voiceRecognition.start();
    
    document.getElementById('voiceToggle').classList.add('active');
    document.getElementById('voiceAssistant').classList.add('active');
    document.getElementById('transcriptText').classList.add('recording');
    document.getElementById('voiceStatusText').textContent = 'Listening... Speak naturally';
    
    // Play start sound
    playClickSound();
}

function stopVoiceAssistant() {
    isListening = false;
    
    if (voiceRecognition) {
        voiceRecognition.stop();
    }
    
    document.getElementById('voiceToggle').classList.remove('active');
    document.getElementById('voiceAssistant').classList.remove('active');
    document.getElementById('transcriptText').classList.remove('recording');
    document.getElementById('voiceStatusText').textContent = 'Click to start voice recording';
    document.getElementById('voiceTranscript').textContent = '';
}

function toggleVoiceAssistant() {
    if (isListening) {
        stopVoiceAssistant();
    } else {
        startVoiceAssistant();
    }
}

async function processVoiceCommand(transcript) {
    if (transcript.includes('stop') || transcript.includes('cancel')) {
        stopVoiceAssistant();
        return;
    }
    
    // Create memory from voice
    try {
        const response = await fetch(`${API_BASE_URL}/voice-memory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ text: transcript })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Memory created from voice!');
            loadMemories();
            loadStats();
            renderCalendar();
            stopVoiceAssistant();
        } else {
            showError(data.error || 'Failed to create memory from voice');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    }
}

// Stats
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('totalMemories').textContent = data.total_memories;
            document.getElementById('totalCategories').textContent = data.categories.length;
            
            // Find favorite mood
            const favoriteMood = data.moods.length > 0 ? data.moods[0]._id : '-';
            document.getElementById('favoriteMood').textContent = favoriteMood.charAt(0).toUpperCase() + favoriteMood.slice(1);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Calendar
function renderCalendar() {
    const calendar = document.getElementById('miniCalendar');
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Clear calendar
    calendar.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = 'bold';
        dayHeader.style.textAlign = 'center';
        calendar.appendChild(dayHeader);
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        calendar.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayMemories = memories.filter(memory => memory.date.startsWith(dateStr));
        
        if (dayMemories.length > 0) {
            dayElement.classList.add('has-memories');
            dayElement.innerHTML = `
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-memories">${dayMemories.length} ${dayMemories.length === 1 ? 'memory' : 'memories'}</div>
            `;
        } else {
            dayElement.innerHTML = `<div class="calendar-day-number">${day}</div>`;
        }
        
        dayElement.addEventListener('click', () => showDayMemories(dateStr, dayMemories));
        calendar.appendChild(dayElement);
    }
}

function showDayMemories(date, dayMemories) {
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <h2>Memories for ${formatDate(date)}</h2>
        ${dayMemories.length === 0 ? '<p>No memories for this day.</p>' : 
            dayMemories.map(memory => `
                <div style="background: var(--surface); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <h3>${memory.title}</h3>
                    <p style="color: var(--text-secondary);">${memory.description}</p>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <span class="memory-category">${memory.category}</span>
                        <span style="background: var(--mood-${memory.mood}); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem;">${memory.mood}</span>
                    </div>
                </div>
            `).join('')
        }
    `;
    
    document.getElementById('memoryModal').style.display = 'block';
}

// Utility Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 500;
        z-index: 3000;
        animation: slideIn 0.3s ease;
        ${type === 'success' ? 'background: var(--success);' : 'background: var(--error);'}
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
function initializeApp() {
    setupEventListeners();
    checkAuthStatus();
    loadTheme();
    
    // Page-specific initialization
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (currentPage === 'index.html') {
        initializeHomePage();
    } else if (currentPage === 'login.html') {
        initializeLoginPage();
    } else if (currentPage === 'register.html') {
        initializeRegisterPage();
    } else if (currentPage === 'dashboard.html') {
        initializeDashboard();
    }
}

// Theme Management
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeIcon();
    
    // Add transition effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // Show notification
    const themeName = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
    showNotification(`${themeName} enabled`, 'success');
}

function updateDarkModeIcon() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (darkModeToggle) {
        const icon = darkModeToggle.querySelector('i');
        if (currentTheme === 'dark') {
            icon.className = 'fas fa-sun';
            darkModeToggle.title = 'Switch to Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            darkModeToggle.title = 'Switch to Dark Mode';
        }
    }
}

// Navigation
function setupEventListeners() {
    // Mobile navigation toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                navMenu.classList.remove('active');
            }
        });
    }
    
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleTheme);
        
        // Update icon based on current theme
        updateDarkModeIcon();
    }
    
    // Logout link
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', handleLogout);
    }
}

// Authentication
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        
        // Update UI for logged-in user
        updateAuthUI();
        
        // Redirect to dashboard if on auth pages
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'login.html' || currentPage === 'register.html') {
            window.location.href = 'dashboard.html';
        }
    }
}

function updateAuthUI() {
    const userName = document.getElementById('userName');
    const userDisplayName = document.getElementById('userDisplayName');
    
    if (currentUser && userName) {
        userName.textContent = currentUser.name || currentUser.email || 'User';
    }
    
    if (currentUser && userDisplayName) {
        userDisplayName.textContent = currentUser.name || currentUser.email || 'User';
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    
    showLoading();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Check if backend is available
    try {
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showSuccess('Login successful! Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        
        // If backend is not available, create a demo account for testing
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
            // Create demo user for testing purposes
            const demoUser = {
                name: email.split('@')[0], // Use email prefix as name
                email: email,
                id: Date.now()
            };
            
            authToken = 'demo_token_' + Date.now();
            currentUser = demoUser;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showSuccess('Demo login successful! Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showError('Network error. Please try again.');
        }
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    if (e) e.preventDefault();
    
    showLoading();
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        hideLoading();
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        hideLoading();
        return;
    }
    
    // Check if backend is available
    try {
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name: `${firstName} ${lastName}`,
                email, 
                password 
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showSuccess('Registration successful! Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        
        // If backend is not available, create a demo account for testing
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
            // Create demo user for testing purposes
            const demoUser = {
                name: `${firstName} ${lastName}`,
                email: email,
                id: Date.now()
            };
            
            authToken = 'demo_token_' + Date.now();
            currentUser = demoUser;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showSuccess('Demo account created! Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showError('Network error. Please try again.');
        }
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    
    showSuccess('Logged out successfully');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Page Initializers
function initializeHomePage() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Social login handlers (placeholder)
    const googleBtn = document.querySelector('.btn-google');
    const facebookBtn = document.querySelector('.btn-facebook');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            showInfo('Google login coming soon!');
        });
    }
    
    if (facebookBtn) {
        facebookBtn.addEventListener('click', () => {
            showInfo('Facebook login coming soon!');
        });
    }
}

function initializeRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (passwordInput && strengthBar && strengthText) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            
            strengthBar.style.width = `${strength.percentage}%`;
            strengthBar.style.backgroundColor = strength.color;
            strengthText.textContent = strength.text;
        });
    }
    
    // Social login handlers (placeholder)
    const googleBtn = document.querySelector('.btn-google');
    const facebookBtn = document.querySelector('.btn-facebook');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            showInfo('Google signup coming soon!');
        });
    }
    
    if (facebookBtn) {
        facebookBtn.addEventListener('click', () => {
            showInfo('Facebook signup coming soon!');
        });
    }
}

function initializeDashboard() {
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }
    
    loadDashboardData();
    setupDashboardEventListeners();
}

async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadRecentMemories(),
        renderMiniCalendar()
    ]);
}

function setupDashboardEventListeners() {
    // Quick add memory
    const quickAddBtn = document.getElementById('quickAddMemory');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            scrollToPanel('memory-creation');
        });
    }
    
    // Voice add memory
    const voiceAddBtn = document.getElementById('voiceAddMemory');
    if (voiceAddBtn) {
        voiceAddBtn.addEventListener('click', toggleVoiceRecording);
    }
    
    // Memory form
    const memoryForm = document.getElementById('memoryForm');
    if (memoryForm) {
        memoryForm.addEventListener('submit', handleMemorySubmit);
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const moodFilter = document.getElementById('moodFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 500));
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleSearch);
    }
    
    if (moodFilter) {
        moodFilter.addEventListener('change', handleSearch);
    }
    
    // Panel toggles
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const panel = this.closest('.dashboard-panel');
            const content = panel.querySelector('.panel-content');
            const icon = this.querySelector('i');
            
            content.classList.toggle('collapsed');
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        });
    });
}

// Dashboard Functions
async function loadStats() {
    try {
        // Check if we're in demo mode
        if (authToken && authToken.startsWith('demo_token_')) {
            // Load demo stats
            document.getElementById('totalMemories').textContent = '12';
            document.getElementById('totalCategories').textContent = '6';
            document.getElementById('favoriteMood').textContent = 'Happy';
            document.getElementById('recentMemories').textContent = '3';
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('totalMemories').textContent = data.total_memories || 0;
            document.getElementById('totalCategories').textContent = data.categories?.length || 0;
            document.getElementById('favoriteMood').textContent = data.favorite_mood || 'Happy';
            document.getElementById('recentMemories').textContent = data.recent_memories || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
        
        // Load demo stats if backend is not available
        if (authToken && authToken.startsWith('demo_token_')) {
            document.getElementById('totalMemories').textContent = '12';
            document.getElementById('totalCategories').textContent = '6';
            document.getElementById('favoriteMood').textContent = 'Happy';
            document.getElementById('recentMemories').textContent = '3';
        }
    }
}

async function loadRecentMemories() {
    try {
        // Check if we're in demo mode
        if (authToken && authToken.startsWith('demo_token_')) {
            // Load demo memories
            const demoMemories = [
                {
                    title: 'Welcome to Memory Assistant',
                    description: 'This is your first demo memory. Start adding your own memories to see them here!',
                    date: new Date().toISOString(),
                    mood: 'happy',
                    category: 'general'
                },
                {
                    title: 'Project Meeting',
                    description: 'Had a productive meeting with the team about the new project timeline.',
                    date: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                    mood: 'excited',
                    category: 'work'
                },
                {
                    title: 'Weekend Adventure',
                    description: 'Went hiking with friends and discovered a beautiful trail.',
                    date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                    mood: 'peaceful',
                    category: 'travel'
                }
            ];
            
            const memoriesList = document.getElementById('recentMemoriesList');
            if (memoriesList) {
                memoriesList.innerHTML = demoMemories.map(memory => `
                    <div class="memory-item">
                        <h4>${memory.title}</h4>
                        <p>${memory.description.substring(0, 100)}${memory.description.length > 100 ? '...' : ''}</p>
                        <small>${formatDate(memory.date)}</small>
                    </div>
                `).join('');
            }
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/memories?limit=5`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const memoriesList = document.getElementById('recentMemoriesList');
            if (memoriesList) {
                memoriesList.innerHTML = data.memories.map(memory => `
                    <div class="memory-item">
                        <h4>${memory.title}</h4>
                        <p>${memory.description.substring(0, 100)}${memory.description.length > 100 ? '...' : ''}</p>
                        <small>${formatDate(memory.date)}</small>
                    </div>
                `).join('') || '<p>No memories yet. Create your first memory!</p>';
            }
        }
    } catch (error) {
        console.error('Failed to load recent memories:', error);
        
        // Load demo memories if backend is not available
        if (authToken && authToken.startsWith('demo_token_')) {
            const memoriesList = document.getElementById('recentMemoriesList');
            if (memoriesList) {
                memoriesList.innerHTML = '<p>Demo memories loaded. Start the backend to see real data.</p>';
            }
        }
    }
}

function renderMiniCalendar() {
    const calendar = document.getElementById('miniCalendar');
    if (!calendar) return;
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Simple calendar implementation
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    
    let calendarHTML = `
        <div style="grid-column: 1/-1; text-align: center; font-weight: bold; margin-bottom: 0.5rem;">
            ${monthNames[currentMonth]} ${currentYear}
        </div>
    `;
    
    // Day headers
    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayHeaders.forEach(day => {
        calendarHTML += `<div style="font-weight: bold; font-size: 0.8rem;">${day}</div>`;
    });
    
    // Empty cells before month starts
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div></div>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate();
        calendarHTML += `
            <div style="
                padding: 0.5rem;
                text-align: center;
                border-radius: 0.25rem;
                ${isToday ? 'background: var(--primary-color); color: white;' : ''}
                cursor: pointer;
                transition: var(--transition);
            " onclick="showDayMemories(${currentYear}, ${currentMonth}, ${day})">
                ${day}
            </div>
        `;
    }
    
    calendar.innerHTML = calendarHTML;
}

async function handleMemorySubmit(e) {
    if (e) e.preventDefault();
    
    showLoading();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('memoryTitle').value);
    formData.append('description', document.getElementById('memoryDescription').value);
    formData.append('date', document.getElementById('memoryDate').value);
    formData.append('mood', document.getElementById('memoryMood').value);
    formData.append('category', document.getElementById('memoryCategory').value);
    formData.append('tags', document.getElementById('memoryTags').value);
    
    const imageInput = document.getElementById('memoryImage');
    if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    
    // Check if we're in demo mode
    if (authToken && authToken.startsWith('demo_token_')) {
        // Simulate memory creation in demo mode
        setTimeout(() => {
            showSuccess('Memory created successfully! (Demo mode)');
            document.getElementById('memoryForm').reset();
            loadDashboardData(); // Reload dashboard data
        }, 1000);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Memory created successfully!');
            document.getElementById('memoryForm').reset();
            loadDashboardData();
        } else {
            showError(data.error || 'Failed to create memory');
        }
    } catch (error) {
        console.error('Memory creation error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    const mood = document.getElementById('moodFilter').value;
    
    // Implement search functionality
    console.log('Searching:', { searchTerm, category, mood });
}

function toggleVoiceRecording() {
    // Implement voice recording functionality
    showInfo('Voice recording coming soon!');
}

function scrollToPanel(panelId) {
    const panel = document.querySelector(`[data-panel="${panelId}"]`);
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth' });
    }
}

// Utility Functions
function calculatePasswordStrength(password) {
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
    
    if (strength < 25) {
        feedback = 'Weak';
        color = '#ef4444';
    } else if (strength < 50) {
        feedback = 'Fair';
        color = '#f59e0b';
    } else if (strength < 75) {
        feedback = 'Good';
        color = '#10b981';
    } else {
        feedback = 'Strong';
        color = '#059669';
    }
    
    return {
        percentage: strength,
        text: feedback,
        color: color
    };
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showDayMemories(year, month, day) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    showInfo(`Memories for ${formatDate(date)} - Feature coming soon!`);
}

// Loading and Notifications
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
