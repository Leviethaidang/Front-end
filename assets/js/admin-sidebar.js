class AdminSidebar {
    constructor(containerId = 'admin-sidebar') {
        this.sidebar = document.getElementById(containerId);
        this.buttons = this.sidebar ? this.sidebar.querySelectorAll('.sidebar-menu-btn') : [];
        this.sections = {};
        this.currentActive = null;
        this.init();
    }

    init() {
        this.buttons.forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId) {
                const section = document.getElementById(targetId);
                if (section) {
                    this.sections[targetId] = section;
                    btn.addEventListener('click', () => this.switchTo(targetId));
                }
            }
        });

        // Activate first button by default if available
        if (this.buttons.length > 0) {
            const firstTarget = this.buttons[0].dataset.target;
            if (firstTarget) {
                this.switchTo(firstTarget);
            }
        }

        // Mobile toggle
        const toggleBtn = document.querySelector('.sidebar-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
    }

    switchTo(targetId) {
        // Hide all sections
        Object.values(this.sections).forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all buttons
        this.buttons.forEach(btn => {
            btn.classList.remove('active');
        });

        // Show target section
        const targetSection = this.sections[targetId];
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Activate target button
        const activeBtn = Array.from(this.buttons).find(btn => btn.dataset.target === targetId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        this.currentActive = targetId;

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    toggleSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.toggle('collapsed');
        }
    }

    closeSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.add('collapsed');
        }
    }

    openSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.remove('collapsed');
        }
    }

    getActive() {
        return this.currentActive;
    }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.adminSidebar && document.getElementById('admin-sidebar')) {
        window.adminSidebar = new AdminSidebar('admin-sidebar');
    }
});
