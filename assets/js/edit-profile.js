document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('edit-profile-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btn = form.querySelector('.btn-primary');
        const originalText = btn.textContent;
        btn.textContent = 'Đang lưu...';
        btn.disabled = true;
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Redirect to profile page
        window.location.href = '/profile.html';
    });
});
