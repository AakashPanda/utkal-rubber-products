/* ============================================
   Utkal Rubber Products - Contact Form Script
   Client-side validation, Formspree integration,
   spam protection, and UI handling
   Formspree : 
   website link : https://formspree.io/ 
   Form : utkalrubberproducts
   username : aakashpanda81@gmail.com
   password : Aakash@2000
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    formspreeEndpoint: 'https://formspree.io/f/xnjwllwv', // Replace with your Formspree endpoint
    rateLimit: {
      maxSubmissions: 3,
      windowMs: 60000, // 1 minute
    },
    debounceDelay: 300, // ms for input validation debounce
    submissionCooldown: 5000, // ms before allowing re-submit
  };

  // ============================================
  // STATE
  // ============================================
  const state = {
    submissionTimestamps: [],
    isSubmitting: false,
    formTouched: {},
  };

  // ============================================
  // DOM REFS
  // ============================================
  const elements = {};

  function cacheElements() {
    elements.form = document.getElementById('contactForm');
    elements.status = document.getElementById('formStatus');
    elements.submitBtn = elements.form?.querySelector('button[type="submit"]');
    elements.fields = {
      name: document.getElementById('name'),
      email: document.getElementById('email'),
      phone: document.getElementById('phone'),
      subject: document.getElementById('subject'),
      message: document.getElementById('message'),
    };
    elements.honeypot = document.getElementById('website'); // hidden spam trap
  }

  // ============================================
  // VALIDATION RULES
  // ============================================
  const validators = {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s\-'\.]+$/,
      message: 'Please enter a valid name (letters, spaces, hyphens only).',
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address.',
    },
    phone: {
      required: false,
      minLength: 8,
      maxLength: 20,
      pattern: /^[\d\s\+\-\(\)]+$/,
      message: 'Please enter a valid phone number (digits, +, -, parentheses).',
    },
    subject: {
      required: false,
      minLength: 3,
      maxLength: 200,
      message: 'Subject must be between 3 and 200 characters.',
    },
    message: {
      required: true,
      minLength: 10,
      maxLength: 5000,
      message: 'Message must be between 10 and 5000 characters.',
    },
  };

  // ============================================
  // HELPER: Debounce
  // ============================================
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============================================
  // HELPER: Sanitize input
  // ============================================
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // VALIDATION ENGINE
  // ============================================
  function validateField(name) {
    const input = elements.fields[name];
    const rules = validators[name];
    if (!input || !rules) return true;

    const value = input.value.trim();
    const errorEl = input.parentElement.querySelector('.field-error');
    const wrapper = input.closest('.form-group');

    // Reset visual state
    input.classList.remove('is-valid', 'is-invalid');
    if (errorEl) errorEl.remove();

    // Skip validation if field is not required and empty
    if (!rules.required && value === '') {
      if (wrapper) wrapper.classList.remove('has-error');
      return true;
    }

    let errorMsg = null;

    if (rules.required && value === '') {
      errorMsg = input.getAttribute('data-error-required') || `This field is required.`;
    } else if (rules.minLength && value.length < rules.minLength) {
      errorMsg = `Please enter at least ${rules.minLength} characters.`;
    } else if (rules.maxLength && value.length > rules.maxLength) {
      errorMsg = `Please keep this under ${rules.maxLength} characters.`;
    } else if (rules.pattern && !rules.pattern.test(value)) {
      errorMsg = rules.message;
    }

    if (errorMsg) {
      input.classList.add('is-invalid');
      if (wrapper) wrapper.classList.add('has-error');

      const error = document.createElement('span');
      error.className = 'field-error';
      error.textContent = errorMsg;
      error.setAttribute('role', 'alert');
      input.parentElement.appendChild(error);
      return false;
    }

    input.classList.add('is-valid');
    if (wrapper) wrapper.classList.remove('has-error');
    return true;
  }

  function validateAll() {
    const fieldNames = Object.keys(validators);
    let allValid = true;
    fieldNames.forEach((name) => {
      if (!validateField(name)) allValid = false;
    });
    return allValid;
  }

  // ============================================
  // SPAM PROTECTION
  // ============================================

  // Honeypot check: hidden field must be empty
  function honeypotCheck() {
    if (!elements.honeypot) return true;
    return elements.honeypot.value.trim() === '';
  }

  // Time-based check: form filled too fast => likely bot
  function timeCheck() {
    const startTime = elements.form.getAttribute('data-start-time');
    if (!startTime) return true;
    const elapsed = Date.now() - parseInt(startTime, 10);
    return elapsed >= 3000; // Must take at least 3 seconds
  }

  // Rate limiting: max N submissions in sliding window
  function rateLimitCheck() {
    const now = Date.now();
    state.submissionTimestamps = state.submissionTimestamps.filter(
      (ts) => now - ts < CONFIG.rateLimit.windowMs
    );
    return state.submissionTimestamps.length < CONFIG.rateLimit.maxSubmissions;
  }

  // Combined spam score (returns true if allowed)
  function spamCheckPasses() {
    let score = 0;
    if (!honeypotCheck()) score += 5;
    if (!timeCheck()) score += 3;
    if (!rateLimitCheck()) score += 4;
    return score < 5;
  }

  // ============================================
  // UI HELPERS
  // ============================================
  function setStatus(type, message) {
    if (!elements.status) return;

    elements.status.style.display = 'block';
    elements.status.className = 'form-status ' + type;
    elements.status.textContent = message;
    elements.status.setAttribute('role', 'alert');

    // Remove after timeout for success
    if (type === 'success') {
      setTimeout(() => {
        elements.status.style.display = 'none';
      }, 10000);
    }
  }

  function clearStatus() {
    if (elements.status) {
      elements.status.style.display = 'none';
      elements.status.className = 'form-status';
      elements.status.textContent = '';
    }
  }

  function setLoading(isLoading) {
    state.isSubmitting = isLoading;
    if (!elements.submitBtn) return;

    const icon = elements.submitBtn.querySelector('i');
    const text = elements.submitBtn.querySelector('.btn-text') || elements.submitBtn;

    if (isLoading) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.classList.add('is-loading');
      if (icon) {
        icon.className = 'fas fa-spinner fa-spin';
      }
      if (text === elements.submitBtn) {
        // No wrapper span, use full button
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      } else {
        text.textContent = 'Sending...';
      }
    } else {
      elements.submitBtn.disabled = false;
      elements.submitBtn.classList.remove('is-loading');
      if (icon) {
        icon.className = 'fas fa-paper-plane';
      }
      if (text === elements.submitBtn) {
        elements.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
      } else {
        text.textContent = 'Send Message';
      }
    }
  }

  function resetFormFields() {
    elements.form.reset();
    Object.keys(elements.fields).forEach((name) => {
      const input = elements.fields[name];
      if (input) {
        input.classList.remove('is-valid', 'is-invalid');
        const error = input.parentElement.querySelector('.field-error');
        if (error) error.remove();
        const wrapper = input.closest('.form-group');
        if (wrapper) wrapper.classList.remove('has-error');
      }
    });
  }

  // ============================================
  // SUBMISSION HANDLER
  // ============================================
  async function handleSubmit(e) {
    e.preventDefault();
    clearStatus();

    // 1. Track when form was first started (timestamp on focus)
    // 2. Validate all fields
    const isValid = validateAll();
    if (!isValid) {
      setStatus('error', 'Please fix the highlighted fields before submitting.');
      // Focus first invalid field
      const firstInvalid = elements.form.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // 3. Spam checks
    if (!spamCheckPasses()) {
      setStatus('error', 'Your submission looks like spam. Please try again later.');
      return;
    }

    // 4. Prevent double submit
    if (state.isSubmitting) return;
    setLoading(true);

    // 5. Collect & sanitize data
    const formData = new FormData(elements.form);
    // Add a timestamp for Formspree
    formData.append('_timestamp', new Date().toISOString());
    // Add reply-to hint
    const email = elements.fields.email?.value.trim();
    if (email) formData.set('_replyto', email);

    try {
      const response = await fetch(CONFIG.formspreeEndpoint, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        setStatus('success', 'Thank you! Your message has been sent successfully. We will get back to you within 24 hours.');
        resetFormFields();
        // Track submission timestamp for rate limiting
        state.submissionTimestamps.push(Date.now());
        // Reset start-time
        elements.form.removeAttribute('data-start-time');
      } else {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || 'Oops! Something went wrong. Please try again or email us directly.';
        setStatus('error', errorMsg);
      }
    } catch (err) {
      setStatus('error', 'Network error. Please check your connection and try again.');
    } finally {
      // Cooldown before allowing re-submit
      setTimeout(() => {
        setLoading(false);
      }, CONFIG.submissionCooldown);
    }
  }

  // ============================================
  // EVENT BINDING
  // ============================================
  function bindEvents() {
    if (!elements.form) return;

    // Form submit
    elements.form.addEventListener('submit', handleSubmit);

    // Real-time field validation (on blur, then debounced on input)
    Object.keys(validators).forEach((name) => {
      const input = elements.fields[name];
      if (!input) return;

      // Mark as touched on blur
      input.addEventListener('blur', function () {
        state.formTouched[name] = true;
        validateField(name);
      });

      // Debounced validation on input (only if touched)
      input.addEventListener(
        'input',
        debounce(function () {
          if (state.formTouched[name]) {
            validateField(name);
          }
        }, CONFIG.debounceDelay)
      );
    });

    // Track form start time (first focus on any field)
    elements.form.addEventListener('focusin', function initStartTime() {
      if (!elements.form.hasAttribute('data-start-time')) {
        elements.form.setAttribute('data-start-time', Date.now().toString());
      }
    });

    // Clear status when user starts typing
    elements.form.addEventListener('input', function () {
      if (elements.status.style.display === 'block') {
        clearStatus();
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    cacheElements();
    if (!elements.form) {
      console.warn('Contact form not found on this page.');
      return;
    }
    bindEvents();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();