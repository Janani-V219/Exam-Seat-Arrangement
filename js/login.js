const form = document.getElementById('login-form');
        const DEFAULT_USERNAME = 'faculty123';
        const DEFAULT_PASSWORD = 'spcet123';

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
                localStorage.setItem('loggedInFaculty', username);
                showNotification('Login successful!', 'success');
                setTimeout(() => window.location.href = 'faculty.html', 2000);
            } else {
                showNotification('Invalid username or password', 'error');
            }
        });

        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'times-circle'}"></i><span>${message}</span>`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateY(0)';
            }, 10);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
