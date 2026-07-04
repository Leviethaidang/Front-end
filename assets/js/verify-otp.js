document.addEventListener('DOMContentLoaded', function() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpForm = document.getElementById('otp-form');
    const otpMessage = document.getElementById('otp-message');
    const resendLink = document.getElementById('resend-link');
    const resendTimer = document.getElementById('resend-timer');
    const verifyButton = document.getElementById('verify-button');
    
    let timer;
    let countdown = 60;
    
    // Auto focus first input
    otpInputs[0].focus();
    
    // OTP input handling
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            
            if (value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            
            checkAllFilled();
        });
        
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
    
    function checkAllFilled() {
        let allFilled = true;
        otpInputs.forEach(input => {
            if (input.value === '') {
                allFilled = false;
            }
        });
        
        verifyButton.disabled = !allFilled;
    }
    
    // Start resend timer
    function startTimer() {
        countdown = 60;
        resendLink.classList.add('disabled');
        resendTimer.style.display = 'inline';
        
        timer = setInterval(() => {
            countdown--;
            resendTimer.textContent = `(${countdown}s)`;
            
            if (countdown <= 0) {
                clearInterval(timer);
                resendLink.classList.remove('disabled');
                resendTimer.style.display = 'none';
            }
        }, 1000);
    }
    
    startTimer();
    
    // Resend OTP
    resendLink.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (resendLink.classList.contains('disabled')) {
            return;
        }
        
        otpMessage.textContent = 'Mã xác thực đã được gửi lại!';
        otpMessage.className = 'message success';
        
        // Clear inputs
        otpInputs.forEach(input => {
            input.value = '';
        });
        otpInputs[0].focus();
        verifyButton.disabled = true;
        
        startTimer();
    });
    
    // Verify OTP
    otpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let otp = '';
        otpInputs.forEach(input => {
            otp += input.value;
        });
        
        verifyButton.disabled = true;
        verifyButton.textContent = 'Đang xác thực...';
        otpMessage.textContent = '';
        
        // Simulate verification
        setTimeout(() => {
            if (otp === '123456') {
                otpMessage.textContent = 'Xác thực thành công! Đang chuyển hướng...';
                otpMessage.className = 'message success';
                
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else {
                otpMessage.textContent = 'Mã xác thực không chính xác. Vui lòng thử lại.';
                otpMessage.className = 'message danger';
                
                // Clear inputs
                otpInputs.forEach(input => {
                    input.value = '';
                });
                otpInputs[0].focus();
                verifyButton.disabled = true;
                verifyButton.textContent = 'Xác thực';
            }
        }, 1500);
    });
});
