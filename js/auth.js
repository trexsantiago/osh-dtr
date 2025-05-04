// Authentication Controller

// Initialize Firebase Authentication
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const loginModal = document.getElementById('login-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const loginError = document.getElementById('login-error');
    const userPanel = document.getElementById('user-panel');
    const userEmail = document.getElementById('user-email');
    
    console.log('Login button found:', loginBtn);
    console.log('Login modal found:', loginModal);
    console.log('Google signin button found:', googleSignInBtn);
    
    // Add event listeners
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            console.log('Login button clicked');
            showLoginModal();
        });
    } else {
        console.error('Login button not found in DOM');
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideLoginModal);
    }
    
    // Add click outside functionality
    window.addEventListener('click', function(event) {
        if (event.target === loginModal) {
            hideLoginModal();
        }
    });
    
    // Set up auth state change listener
    firebase.auth().onAuthStateChanged(handleAuthStateChange);
    
    // Show login modal
    function showLoginModal() {
        console.log('Showing login modal');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            // Add visible class for animation
            setTimeout(() => {
                loginModal.classList.add('visible');
            }, 10); // Small delay to ensure transition works
        }
    }
    
    // Hide login modal
    function hideLoginModal() {
        console.log('Hiding login modal');
        if (loginModal) {
            loginModal.classList.remove('visible');
            // Add a small delay before hiding completely (for animation)
            setTimeout(() => {
                loginModal.classList.add('hidden');
                if (loginError) {
                    loginError.classList.add('hidden');
                    loginError.textContent = '';
                }
            }, 300); // Match transition duration
        }
    }
    
    // Handle Google Sign In
    function handleGoogleSignIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Restrict to wpu.edu.ph domain
        provider.setCustomParameters({
            'hd': 'wpu.edu.ph'
        });
        
        // Show loading state
        if (googleSignInBtn) {
            googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Signing in...</span>';
            googleSignInBtn.disabled = true;
        }
        
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                // Successfully signed in
                console.log('Successfully signed in:', result.user);
                hideLoginModal();
            })
            .catch((error) => {
                // Handle Errors here.
                console.error('Sign-in error:', error);
                if (loginError) {
                    loginError.textContent = error.message;
                    loginError.classList.remove('hidden');
                }
                
                // Reset button
                if (googleSignInBtn) {
                    googleSignInBtn.innerHTML = '<i class="fab fa-google"></i><span>Sign in with Google</span>';
                    googleSignInBtn.disabled = false;
                }
            });
    }
    
    // Handle Logout
    function handleLogout() {
        firebase.auth().signOut()
            .then(() => {
                console.log('Signed out successfully');
            })
            .catch((error) => {
                console.error('Sign-out error:', error);
            });
    }
    
    // Handle Authentication State Changes
    function handleAuthStateChange(user) {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user);
            
            // Hide login button, show user panel
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userPanel) userPanel.classList.remove('hidden');
            
            // Update user info
            if (userEmail) userEmail.textContent = user.email;
            
            // Update user avatar with Google profile image
            const avatarElement = userPanel.querySelector('.user-avatar');
            if (avatarElement) {
                if (user.photoURL) {
                    // User has a profile photo from Google
                    avatarElement.innerHTML = `<img src="${user.photoURL}" alt="User avatar">`;
                } else {
                    // No profile photo, use default icon
                    avatarElement.innerHTML = '<i class="fas fa-user-circle"></i>';
                }
            }
            
            console.log('Avatar updated with user photo');
            
            // Add class to body to enable authenticated features
            document.body.classList.add('user-authenticated');
            document.body.classList.remove('user-unauthenticated');
        } else {
            // User is signed out
            console.log('User is signed out');
            
            // Show login button, hide user panel
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userPanel) userPanel.classList.add('hidden');
            if (userEmail) userEmail.textContent = '';
            
            // Reset avatar to default icon
            const avatarElement = userPanel.querySelector('.user-avatar');
            if (avatarElement) {
                avatarElement.innerHTML = '<i class="fas fa-user-circle"></i>';
            }
            
            // Update body class to disable authenticated features
            document.body.classList.remove('user-authenticated');
            document.body.classList.add('user-unauthenticated');
        }
    }
});