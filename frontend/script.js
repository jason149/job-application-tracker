// API URL
const API_URL = 'http://localhost:8000';

// DOM Elements
const applicationsContainer = document.getElementById('applications-container');
const emptyState = document.getElementById('empty-state');
const applicationModal = document.getElementById('application-modal');
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const applicationForm = document.getElementById('application-form');
const newApplicationBtn = document.getElementById('new-application-btn');
const cancelBtn = document.getElementById('cancel-btn');
const statusFilter = document.getElementById('status-filter');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

// Form Elements
const applicationIdInput = document.getElementById('application-id');
const companyInput = document.getElementById('company');
const positionInput = document.getElementById('position');
const dateAppliedInput = document.getElementById('date-applied');
const statusInput = document.getElementById('status');
const notesInput = document.getElementById('notes');

// Statistics Elements
const totalApplicationsEl = document.getElementById('total-applications');
const appliedCountEl = document.getElementById('applied-count');
const interviewCountEl = document.getElementById('interview-count');
const offeredCountEl = document.getElementById('offered-count');
const rejectedCountEl = document.getElementById('rejected-count');

// Global variables
let applications = [];
let currentApplicationId = null;

// Check auth status
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    fetch(`${API_URL}/me`, {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            window.location.href = 'login.html';
            return;
        }
        // User is logged in, initialize app
        initializeApp();
    })
    .catch(error => {
        console.error('Auth check failed:', error);
        window.location.href = 'login.html';
    });
    
    // Add logout button
    const header = document.querySelector('header');
    if (header) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn logout-btn';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.addEventListener('click', logout);
        header.appendChild(logoutBtn);
        
        // Add style for logout button
        const style = document.createElement('style');
        style.textContent = `
            .logout-btn {
                background-color: transparent;
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.5);
                padding: 0.4rem 0.8rem;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
                margin-left: auto;
            }
            .logout-btn:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            header {
                display: flex;
                align-items: center;
            }
        `;
        document.head.appendChild(style);
    }
});

// Logout function
function logout() {
    fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(() => {
        window.location.href = 'login.html';
    })
    .catch(error => {
        console.error('Logout failed:', error);
    });
}

// Initialize application after authentication
function initializeApp() {
    // Event Listeners
    if (newApplicationBtn) {
        newApplicationBtn.addEventListener('click', openNewApplicationModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    if (applicationForm) {
        applicationForm.addEventListener('submit', saveApplication);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', filterApplications);
    }
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteApplication);
    }
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', closeConfirmModal);
    }

    // Close modals when clicking on X or outside
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            applicationModal.style.display = 'none';
            confirmModal.style.display = 'none';
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target === applicationModal) {
            applicationModal.style.display = 'none';
        }
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
        }
    });
    
    // Fetch applications on load
    fetchApplications();
}

// Fetch applications from API
async function fetchApplications() {
    try {
        const statusFilterValue = document.getElementById('status-filter').value;
        let url = `${API_URL}/applications/`;
        
        if (statusFilterValue) {
            url += `?status=${statusFilterValue}`;
        }
        
        const response = await fetch(url, {
            credentials: 'include'  // Include credentials for authentication
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized, redirect to login
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to fetch applications');
        }
        
        applications = await response.json();
        renderApplications();
        fetchStatistics();
        
    } catch (error) {
        console.error('Error fetching applications:', error);
        showError('Failed to load applications. Please try again.');
    }
}

// Fetch statistics
async function fetchStatistics() {
    try {
        const response = await fetch(`${API_URL}/statistics/`, {
            credentials: 'include'  // Include credentials for authentication
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch statistics');
        }
        
        const stats = await response.json();
        updateStatistics(stats);
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
    }
}

// Update statistics display
function updateStatistics(stats) {
    if (!totalApplicationsEl) return;
    
    totalApplicationsEl.textContent = stats.total_applications;
    
    // Initialize counters
    let appliedCount = 0;
    let interviewCount = 0;
    let offeredCount = 0;
    let rejectedCount = 0;
    
    // Count by status
    for (const [status, count] of Object.entries(stats.status_counts)) {
        if (status.toLowerCase() === 'applied') {
            appliedCount = count;
        } else if (status.toLowerCase().includes('interview') || status.toLowerCase().includes('phone')) {
            interviewCount += count;
        } else if (status.toLowerCase() === 'offered' || status.toLowerCase() === 'hired') {
            offeredCount += count;
        } else if (status.toLowerCase() === 'rejected' || status.toLowerCase() === 'declined') {
            rejectedCount += count;
        }
    }
    
    // Update display
    appliedCountEl.textContent = appliedCount;
    interviewCountEl.textContent = interviewCount;
    offeredCountEl.textContent = offeredCount;
    rejectedCountEl.textContent = rejectedCount;
}

// Render applications
function renderApplications() {
    if (!applicationsContainer) return;
    
    // Clear applications container except for empty state
    const nodes = applicationsContainer.childNodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i] !== emptyState) {
            applicationsContainer.removeChild(nodes[i]);
        }
    }
    
    // Show/hide empty state
    if (applications.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    } else {
        if (emptyState) emptyState.style.display = 'none';
    }
    
    // Render each application
    applications.forEach(application => {
        const card = createApplicationCard(application);
        applicationsContainer.appendChild(card);
    });
}

// Create application card
function createApplicationCard(application) {
    const card = document.createElement('div');
    card.className = 'application-card';
    card.dataset.id = application.id;
    
    // Format date
    const date = new Date(application.date_applied);
    const formattedDate = date.toLocaleDateString();
    
    // Get status class
    const statusClass = getStatusClass(application.status);
    
    card.innerHTML = `
        <div class="application-header">
            <div class="company-name">${application.company}</div>
            <div class="position-title">${application.position}</div>
        </div>
        <div class="application-details">
            <div class="detail-item">
                <i class="fas fa-calendar-alt detail-icon"></i>
                <span>Applied on: ${formattedDate}</span>
            </div>
            <div class="detail-item">
                <i class="fas fa-info-circle detail-icon"></i>
                <span class="application-status ${statusClass}">${application.status}</span>
            </div>
        </div>
        
        ${application.notes ? `<div class="notes-content">${application.notes}</div>` : ''}
        
        <div class="application-actions">
            <button class="action-btn edit" onclick="openEditApplicationModal('${application.id}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete" onclick="openDeleteConfirmation('${application.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return card;
}

// Get status CSS class
function getStatusClass(status) {
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'applied') {
        return 'status-applied';
    } else if (statusLower === 'phone screening') {
        return 'status-phone-screening';
    } else if (statusLower.includes('interview')) {
        return 'status-interview-scheduled';
    } else if (statusLower === 'offered') {
        return 'status-offered';
    } else if (statusLower === 'hired') {
        return 'status-hired';
    } else if (statusLower === 'rejected') {
        return 'status-rejected';
    } else if (statusLower === 'declined') {
        return 'status-declined';
    }
    
    return '';
}

// Open new application modal
function openNewApplicationModal() {
    // Clear form
    applicationForm.reset();
    applicationIdInput.value = '';
    currentApplicationId = null;
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    dateAppliedInput.value = today;
    
    // Update modal title
    modalTitle.textContent = 'Add New Application';
    
    // Open modal
    applicationModal.style.display = 'block';
}

// Open edit application modal
function openEditApplicationModal(id) {
    const application = applications.find(app => app.id === id);
    
    if (!application) {
        showError('Application not found');
        return;
    }
    
    // Fill form
    applicationIdInput.value = application.id;
    companyInput.value = application.company;
    positionInput.value = application.position;
    dateAppliedInput.value = application.date_applied;
    statusInput.value = application.status;
    notesInput.value = application.notes || '';
    
    currentApplicationId = application.id;
    
    // Update modal title
    modalTitle.textContent = 'Edit Application';
    
    // Open modal
    applicationModal.style.display = 'block';
}

// Close application modal
function closeModal() {
    applicationModal.style.display = 'none';
}

// Open delete confirmation dialog
function openDeleteConfirmation(id) {
    currentApplicationId = id;
    confirmModal.style.display = 'block';
}

// Close confirmation modal
function closeConfirmModal() {
    confirmModal.style.display = 'none';
    currentApplicationId = null;
}

// Save application (create or update)
async function saveApplication(event) {
    event.preventDefault();
    
    const application = {
        company: companyInput.value,
        position: positionInput.value,
        date_applied: dateAppliedInput.value,
        status: statusInput.value,
        notes: notesInput.value
    };
    
    try {
        let response;
        
        if (applicationIdInput.value) {
            // Update existing application
            application.id = applicationIdInput.value;
            response = await fetch(`${API_URL}/applications/${application.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(application),
                credentials: 'include'  // Include credentials for authentication
            });
        } else {
            // Create new application
            response = await fetch(`${API_URL}/applications/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(application),
                credentials: 'include'  // Include credentials for authentication
            });
        }
        
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized, redirect to login
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to save application');
        }
        
        // Close modal and refresh applications
        closeModal();
        fetchApplications();
        
    } catch (error) {
        console.error('Error saving application:', error);
        showError('Failed to save application. Please try again.');
    }
}

// Delete application
async function deleteApplication() {
    if (!currentApplicationId) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/applications/${currentApplicationId}`, {
            method: 'DELETE',
            credentials: 'include'  // Include credentials for authentication
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized, redirect to login
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to delete application');
        }
        
        // Close modal and refresh applications
        closeConfirmModal();
        fetchApplications();
        
    } catch (error) {
        console.error('Error deleting application:', error);
        showError('Failed to delete application. Please try again.');
    }
}

// Filter applications
function filterApplications() {
    fetchApplications();
}

// Show error message
function showError(message) {
    alert(message);
}