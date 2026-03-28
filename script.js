document.addEventListener('DOMContentLoaded', () => {
    // 1. Sticky Navbar & Active links setup
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const links = document.querySelectorAll('.nav-links a');

    // Handle scroll events
    window.addEventListener('scroll', () => {
        // Sticky nav
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = hamburger.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });

    // Close mobile menu when a link is clicked
    links.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = hamburger.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        });
    });

    // 2. Form Validation
    const form = document.getElementById('contactForm');
    const successMsg = document.getElementById('successMsg');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isValid = true;
            
            // Validate Name
            const nameField = document.getElementById('name');
            const nameGroup = nameField.parentElement;
            if (nameField.value.trim() === '') {
                nameGroup.classList.add('invalid');
                isValid = false;
            } else {
                nameGroup.classList.remove('invalid');
            }

            // Validate Email
            const emailField = document.getElementById('email');
            const emailGroup = emailField.parentElement;
            const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
            if (!emailField.value.match(emailPattern)) {
                emailGroup.classList.add('invalid');
                isValid = false;
            } else {
                emailGroup.classList.remove('invalid');
            }

            // Validate Message
            const msgField = document.getElementById('message');
            const msgGroup = msgField.parentElement;
            if (msgField.value.trim() === '') {
                msgGroup.classList.add('invalid');
                isValid = false;
            } else {
                msgGroup.classList.remove('invalid');
            }

            // Submit logic
            if (isValid) {
                // Here you would normally send the data to a backend via fetch/XHR
                // Simulating a successful request:
                const submitBtn = document.getElementById('submitBtn');
                submitBtn.disabled = true;
                submitBtn.innerText = 'Sending...';

                setTimeout(() => {
                    successMsg.style.display = 'block';
                    form.reset();
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Send Message';
                    
                    // Hide success message after 5 seconds
                    setTimeout(() => {
                        successMsg.style.display = 'none';
                    }, 5000);
                }, 1500);
            }
        });
        
        // Remove error on input
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                input.parentElement.classList.remove('invalid');
            });
        });
    }
});