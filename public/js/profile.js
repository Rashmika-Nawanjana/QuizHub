// Optimized Dashboard JavaScript
class DashboardManager {
    constructor() {
        this.loadedSections = new Set();
        this.cache = new Map();
        this.loadingStates = new Set();
        this.init();
    }

    init() {
        // Add loading states and event listeners
        this.setupNavigation();
        this.setupLazyLoading();
        this.loadEssentialData();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    setupLazyLoading() {
        // Intersection Observer for lazy loading sections when they come into view
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    if (!this.loadedSections.has(sectionId) && sectionId !== 'dashboard') {
                        this.loadSectionData(sectionId);
                    }
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.content-section').forEach(section => {
            sectionObserver.observe(section);
        });
    }

    switchSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Load data if not already loaded
            if (!this.loadedSections.has(sectionName)) {
                this.loadSectionData(sectionName);
            }
        }
    }

    loadEssentialData() {
        // Dashboard is already loaded server-side, just mark as loaded
        this.loadedSections.add('dashboard');
        this.loadedSections.add('recent-attempts');
    }

    async loadSectionData(sectionName) {
        if (this.loadingStates.has(sectionName)) {
            return; // Already loading
        }

        // Check cache first
        if (this.cache.has(sectionName)) {
            this.renderSection(sectionName, this.cache.get(sectionName));
            return;
        }

        this.loadingStates.add(sectionName);
        const sectionElement = document.getElementById(sectionName);
        
        try {
            // Show loading spinner
            this.showLoadingState(sectionElement);

            let data;
            switch (sectionName) {
                case 'modules':
                    data = await this.fetchModules();
                    break;
                case 'analytics':
                    data = await this.fetchAnalytics();
                    break;
                case 'achievements':
                    data = await this.fetchAchievements();
                    break;
                default:
                    console.warn(`No loader defined for section: ${sectionName}`);
                    return;
            }

            // Cache the data
            this.cache.set(sectionName, data);
            
            // Render the section
            this.renderSection(sectionName, data);
            this.loadedSections.add(sectionName);

        } catch (error) {
            console.error(`Error loading ${sectionName}:`, error);
            this.showErrorState(sectionElement, `Failed to load ${sectionName}`);
        } finally {
            this.loadingStates.delete(sectionName);
        }
    }

    async fetchModules() {
        const userId = window.currentUserId; // Set this in the template
        const response = await fetch(`/api/dashboard/modules/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch modules');
        return await response.json();
    }

    async fetchAnalytics() {
        const userId = window.currentUserId;
        const response = await fetch(`/api/dashboard/analytics/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch analytics');
        return await response.json();
    }

    async fetchAchievements() {
        const userId = window.currentUserId;
        const response = await fetch(`/api/dashboard/achievements/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch achievements');
        return await response.json();
    }

    showLoadingState(element) {
        const loadingHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
        
        // Only update the main content, preserve the header
        const contentArea = element.querySelector('.section-content') || element;
        if (contentArea !== element) {
            contentArea.innerHTML = loadingHTML;
        } else {
            const header = element.querySelector('.content-header');
            const headerHTML = header ? header.outerHTML : '';
            element.innerHTML = headerHTML + loadingHTML;
        }
    }

    showErrorState(element, message) {
        const errorHTML = `
            <div class="error-container">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <p>${message}</p>
                <button class="btn-retry" onclick="dashboardManager.reloadSection('${element.id}')">
                    <i class="fas fa-redo"></i>
                    Retry
                </button>
            </div>
        `;
        
        const contentArea = element.querySelector('.section-content') || element;
        if (contentArea !== element) {
            contentArea.innerHTML = errorHTML;
        } else {
            const header = element.querySelector('.content-header');
            const headerHTML = header ? header.outerHTML : '';
            element.innerHTML = headerHTML + errorHTML;
        }
    }

    renderSection(sectionName, data) {
        const section = document.getElementById(sectionName);
        
        switch (sectionName) {
            case 'modules':
                this.renderModules(section, data);
                break;
            case 'analytics':
                this.renderAnalytics(section, data);
                break;
            case 'achievements':
                this.renderAchievements(section, data);
                break;
        }
    }

    renderModules(section, modules) {
        const modulesGrid = section.querySelector('.modules-grid');
        if (!modulesGrid) return;

        modulesGrid.innerHTML = modules.map(module => `
            <div class="module-card-premium">
                <div class="module-background">
                    <div class="module-icon-large">
                        <i class="${module.icon}"></i>
                    </div>
                </div>
                
                <div class="module-content">
                    <div class="module-header">
                        <h3>${module.name}</h3>
                        <span class="module-code">${module.code}</span>
                    </div>
                    <div class="module-progress-summary" style="margin: 8px 0; font-weight: 500; color: var(--github-text);">
                        <span>
                            <i class="fas fa-clipboard-check"></i>
                            ${module.completedQuizzes} of ${module.totalQuizzes} quizzes completed
                        </span>
                        &nbsp;|&nbsp;
                        <span>
                            <i class="fas fa-percentage"></i>
                            Avg: ${module.averageScore}%
                        </span>
                        &nbsp;|&nbsp;
                        <span>
                            <i class="fas fa-trophy"></i>
                            Best: ${module.bestScore}%
                        </span>
                        &nbsp;|&nbsp;
                        <span>
                            <i class="fas fa-clock"></i>
                            Time: ${module.timeSpent}
                        </span>
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-info">
                            <span>Progress</span>
                            <span>${module.progress}%</span>
                        </div>
                        <div class="progress-bar-modern">
                            <div class="progress-fill" style="width: ${module.progress}%;"></div>
                        </div>
                    </div>
                    
                    <div class="module-stats-grid">
                        <div class="stat-mini">
                            <span class="stat-label">Completed</span>
                            <span class="stat-value">${module.completedQuizzes}/${module.totalQuizzes}</span>
                        </div>
                        <div class="stat-mini">
                            <span class="stat-label">Avg Score</span>
                            <span class="stat-value">${module.averageScore}%</span>
                        </div>
                        <div class="stat-mini">
                            <span class="stat-label">Best</span>
                            <span class="stat-value">${module.bestScore}%</span>
                        </div>
                        <div class="stat-mini">
                            <span class="stat-label">Time</span>
                            <span class="stat-value">${module.timeSpent}</span>
                        </div>
                    </div>
                    
                    <div class="module-actions">
                        <a class="btn-module-continue" href="/modules/${module.code}">
                            <i class="fas fa-play"></i>
                            Continue
                        </a>
                        <button class="btn-module-history" onclick="viewHistory('${module.id}')">
                            <i class="fas fa-history"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAnalytics(section, data) {
        const { userAnalytics, moduleAnalytics } = data;
        
        // Update user analytics
        const userDetailsContainer = section.querySelector('.analytics-user-details ul');
        if (userDetailsContainer) {
            userDetailsContainer.innerHTML = `
                <li><strong>Total Quizzes Completed:</strong> ${userAnalytics.totalQuizzes}</li>
                <li><strong>Total Time Spent:</strong> ${Math.floor(userAnalytics.totalTime/60)}m ${userAnalytics.totalTime%60}s</li>
                <li><strong>Average Score:</strong> ${userAnalytics.avgScore}%</li>
                <li><strong>Best Score:</strong> ${userAnalytics.bestScore}%</li>
            `;
        }
        
        // Update module analytics table
        const moduleTableBody = section.querySelector('.analytics-module-table-container tbody');
        if (moduleTableBody) {
            moduleTableBody.innerHTML = moduleAnalytics.map(m => `
                <tr>
                    <td>${m.module}</td>
                    <td>${m.avgScore}%</td>
                    <td>${m.bestScore}%</td>
                    <td>${m.totalAttempts}</td>
                </tr>
            `).join('');
        }
    }

    renderAchievements(section, achievements) {
        const achievementsGrid = section.querySelector('.achievements-grid');
        if (!achievementsGrid) return;

        if (achievements.length === 0) {
            achievementsGrid.innerHTML = `
                <div class="empty-state">
                    <p>No achievements available.</p>
                </div>
            `;
            return;
        }

        achievementsGrid.innerHTML = achievements.map(achievement => `
            <div class="achievement-card-premium ${achievement.unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-glow"></div>
                <div class="achievement-icon-premium">
                    <i class="${achievement.icon}"></i>
                </div>
                <div class="achievement-content">
                    <h3>${achievement.name}</h3>
                    <p>${achievement.description}</p>
                    ${achievement.unlocked ? `
                        <div class="achievement-date">
                            <i class="fas fa-check-circle"></i>
                            Unlocked on ${achievement.unlockedDate}
                        </div>
                    ` : `
                        <div class="achievement-progress">
                            <div class="progress-bar-achievement">
                                <div class="progress-fill" style="width: ${achievement.progress}%;"></div>
                            </div>
                            <span>${achievement.progress}% complete</span>
                        </div>
                    `}
                </div>
            </div>
        `).join('');
    }

    reloadSection(sectionName) {
        this.cache.delete(sectionName);
        this.loadedSections.delete(sectionName);
        this.loadSectionData(sectionName);
    }

    // Quick action functions
    startQuiz() {
        window.location.href = '/home';
    }

    viewProgress() {
        this.switchSection('modules');
        document.querySelector('[data-section="modules"]').classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.dataset.section !== 'modules') nav.classList.remove('active');
        });
    }

    reviewMistakes() {
        this.switchSection('recent-attempts');
        document.querySelector('[data-section="recent-attempts"]').classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.dataset.section !== 'recent-attempts') nav.classList.remove('active');
        });
    }
}

// Initialize dashboard when DOM is loaded
let dashboardManager;
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
});

// Global functions for compatibility with existing HTML
function startQuiz() {
    dashboardManager.startQuiz();
}

function viewProgress() {
    dashboardManager.viewProgress();
}

function reviewMistakes() {
    dashboardManager.reviewMistakes();
}

function viewAllAttempts() {
    dashboardManager.switchSection('all-attempts');
}

function retakeQuiz(quizId) {
    // Implement quiz retake logic
    console.log('Retaking quiz:', quizId);
}

function viewHistory(moduleId) {
    // Implement module history view
    console.log('Viewing history for module:', moduleId);
}

function editAvatar() {
    // Implement avatar edit functionality
    console.log('Edit avatar clicked');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
    }
}