const API_BASE_URL = window.BACKEND_URL || 'http://localhost:5000';

async function apiCall(method, endpoint, data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function setCurrentUser(user) {
    localStorage.setItem('pawportionCurrentUser', JSON.stringify(user));
}

const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('petName').value.trim();
        const breed = document.getElementById('petBreed').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const imageFile = document.getElementById('petImage').files[0];
        const errorEl = document.getElementById('registerError');

        errorEl.textContent = '';

        if (!name || !breed || !email || !password) {
            errorEl.textContent = 'Please fill all required fields.';
            return;
        }

        let petImage = 'https://placehold.co/72x72/orange/white?text=🐶';

        if (imageFile) {
            const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
                errorEl.textContent = 'Image is too large. Please upload an image smaller than 5MB.';
                return;
            }

            petImage = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(petImage);
                reader.readAsDataURL(imageFile);
            });
        }

        try {
            const result = await apiCall('POST', '/api/auth/register', {
                petName: name,
                breed,
                email,
                password,
                petImage
            });

            setCurrentUser(result.user);
            window.location.href = 'index.html';
        } catch (error) {
            errorEl.textContent = error.message;
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        errorEl.textContent = '';

        try {
            const result = await apiCall('POST', '/api/auth/login', { email, password });
            setCurrentUser(result.user);
            window.location.href = 'index.html';
        } catch (error) {
            errorEl.textContent = error.message;
        }
    });
}
