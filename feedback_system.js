// feedback_system.js - User Feedback Collection System
// This script handles the feedback popup and collection logic

class FeedbackSystem {
  constructor() {
    this.feedbackData = {
      hasShownFeedback: false,
      feedbackShownCount: 0,
      lastFeedbackShown: null,
      userFeedback: null,
      extensionUsageCount: 0,
      lastActiveDate: null
    };
    
    this.init();
  }

  async init() {
    // Load existing feedback data
    await this.loadFeedbackData();
    
    // Check if we should show feedback
    this.checkFeedbackEligibility();
    
    // Listen for extension usage events
    this.setupEventListeners();
  }

  async loadFeedbackData() {
    try {
      const result = await chrome.storage.sync.get(['feedbackData']);
      if (result.feedbackData) {
        this.feedbackData = { ...this.feedbackData, ...result.feedbackData };
      }
    } catch (error) {
      console.log('Error loading feedback data:', error);
    }
  }

  async saveFeedbackData() {
    try {
      await chrome.storage.sync.set({ feedbackData: this.feedbackData });
    } catch (error) {
      console.log('Error saving feedback data:', error);
    }
  }

  setupEventListeners() {
    // Listen for successful location spoofing
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.geoSettings) {
        const newSettings = changes.geoSettings.newValue;
        if (newSettings && newSettings.enabled) {
          this.incrementUsageCount();
        }
      }
    });

    // Listen for location saves
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.savedLocations) {
        this.incrementUsageCount();
      }
    });

    // Listen for website highlighting
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.highlightedDomains) {
        this.incrementUsageCount();
      }
    });
  }

  async incrementUsageCount() {
    this.feedbackData.extensionUsageCount++;
    this.feedbackData.lastActiveDate = Date.now();
    await this.saveFeedbackData();
    
    // Check if we should show feedback after usage
    this.checkFeedbackEligibility();
  }

  checkFeedbackEligibility() {
    // Don't show if user already gave feedback
    if (this.feedbackData.userFeedback) {
      return;
    }

    // Don't show if we've shown it too many times
    if (this.feedbackData.feedbackShownCount >= 3) {
      return;
    }

    // Don't show if we showed it recently (within 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (this.feedbackData.lastFeedbackShown && this.feedbackData.lastFeedbackShown > sevenDaysAgo) {
      return;
    }

    // Show feedback after user has used the extension a few times
    if (this.feedbackData.extensionUsageCount >= 5) {
      this.showFeedbackPopup();
    }
  }

  showFeedbackPopup() {
    // Don't show if popup is already visible
    if (document.getElementById('gtrack-feedback-popup')) {
      return;
    }

    // Update feedback shown data
    this.feedbackData.feedbackShownCount++;
    this.feedbackData.lastFeedbackShown = Date.now();
    this.saveFeedbackData();

    // Create and show the feedback popup
    this.createFeedbackPopup();
  }

  createFeedbackPopup() {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'gtrack-feedback-popup';
    overlay.className = 'gtrack-feedback-overlay';
    overlay.innerHTML = `
      <div class="gtrack-feedback-popup">
        <div class="gtrack-feedback-header">
          <h3>How's the GTrack extension working for you?</h3>
          <button class="gtrack-feedback-close" id="gtrack-feedback-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="gtrack-feedback-content">
          <div class="gtrack-feedback-options">
            <button class="gtrack-feedback-option" data-feedback="bad">
              <span class="feedback-emoji">😞</span>
              <span class="feedback-text">Bad</span>
            </button>
            <button class="gtrack-feedback-option" data-feedback="ok">
              <span class="feedback-emoji">😐</span>
              <span class="feedback-text">OK</span>
            </button>
            <button class="gtrack-feedback-option" data-feedback="love">
              <span class="feedback-emoji">😍</span>
              <span class="feedback-text">Love it</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addFeedbackStyles();

    // Add to document
    document.body.appendChild(overlay);

    // Add event listeners
    this.setupFeedbackEventListeners(overlay);

    // Auto-close after 30 seconds if no interaction
    setTimeout(() => {
      if (document.getElementById('gtrack-feedback-popup')) {
        this.closeFeedbackPopup();
      }
    }, 30000);
  }

  addFeedbackStyles() {
    if (document.getElementById('gtrack-feedback-styles')) {
      return; // Styles already added
    }

    const styles = document.createElement('style');
    styles.id = 'gtrack-feedback-styles';
    styles.textContent = `
      .gtrack-feedback-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .gtrack-feedback-popup {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 400px;
        width: 90%;
        max-height: 90vh;
        overflow: hidden;
        animation: gtrack-feedback-slide-in 0.3s ease-out;
      }

      @keyframes gtrack-feedback-slide-in {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .gtrack-feedback-header {
        padding: 20px 20px 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .gtrack-feedback-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        line-height: 1.4;
        flex: 1;
        margin-right: 10px;
      }

      .gtrack-feedback-close {
        background: none;
        border: none;
        padding: 4px;
        border-radius: 6px;
        cursor: pointer;
        color: #6b7280;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      }

      .gtrack-feedback-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .gtrack-feedback-content {
        padding: 20px;
      }

      .gtrack-feedback-options {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .gtrack-feedback-option {
        background: #f9fafb;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px 12px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 80px;
        flex: 1;
      }

      .gtrack-feedback-option:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      .gtrack-feedback-option.selected {
        background: #dbeafe;
        border-color: #3b82f6;
        transform: translateY(-2px);
      }

      .gtrack-feedback-option[data-feedback="bad"].selected {
        background: #fef2f2;
        border-color: #ef4444;
      }

      .gtrack-feedback-option[data-feedback="ok"].selected {
        background: #fffbeb;
        border-color: #f59e0b;
      }

      .gtrack-feedback-option[data-feedback="love"].selected {
        background: #f0fdf4;
        border-color: #10b981;
      }

      .feedback-emoji {
        font-size: 24px;
        line-height: 1;
      }

      .feedback-text {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
      }

      .gtrack-feedback-option.selected .feedback-text {
        color: #1f2937;
        font-weight: 600;
      }

      /* Responsive design */
      @media (max-width: 480px) {
        .gtrack-feedback-popup {
          margin: 20px;
          width: calc(100% - 40px);
        }
        
        .gtrack-feedback-options {
          flex-direction: column;
          gap: 8px;
        }
        
        .gtrack-feedback-option {
          flex-direction: row;
          justify-content: flex-start;
          padding: 12px 16px;
          min-width: auto;
        }
        
        .feedback-emoji {
          font-size: 20px;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  setupFeedbackEventListeners(overlay) {
    const closeBtn = overlay.querySelector('#gtrack-feedback-close');
    const options = overlay.querySelectorAll('.gtrack-feedback-option');

    // Close button
    closeBtn.addEventListener('click', () => {
      this.closeFeedbackPopup();
    });

    // Overlay click to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeFeedbackPopup();
      }
    });

    // Option selection
    options.forEach(option => {
      option.addEventListener('click', () => {
        const feedback = option.dataset.feedback;
        this.handleFeedbackSelection(feedback);
      });

      // Hover effects - only visual, no selection
      option.addEventListener('mouseenter', () => {
        // Just add hover effect without selecting
        option.style.transform = 'translateY(-2px)';
      });
      
      option.addEventListener('mouseleave', () => {
        // Remove hover effect
        option.style.transform = 'translateY(0)';
      });
    });

    // Escape key to close
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeFeedbackPopup();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  async handleFeedbackSelection(feedback) {
    // Save the feedback
    this.feedbackData.userFeedback = feedback;
    await this.saveFeedbackData();

    // Show thank you message
    this.showThankYouMessage(feedback);

    // Handle different feedback types
    if (feedback === 'bad') {
      // For negative feedback, just show message and close
      setTimeout(() => {
        this.closeFeedbackPopup();
      }, 3000);
    } else if (feedback === 'ok' || feedback === 'love') {
      // For positive feedback, redirect to Chrome Web Store reviews
      setTimeout(() => {
        this.redirectToChromeWebStore();
      }, 2000);
    }
  }

  showThankYouMessage(feedback) {
    const popup = document.querySelector('.gtrack-feedback-popup');
    if (!popup) return;

    const messages = {
      bad: 'We are sorry that we didn\'t meet your extension expectation.',
      ok: 'Thanks for your feedback! We appreciate it.',
      love: 'Awesome! Thanks for loving GTrack! 🎉'
    };

    const emojis = {
      bad: '😞',
      ok: '😐',
      love: '😍'
    };

    const subMessages = {
      bad: 'We\'ll work to improve your experience.',
      ok: 'Redirecting you to leave a review...',
      love: 'Please, write a review on Chrome Web Store to help others discover GTrack!'
    };

    popup.innerHTML = `
      <div class="gtrack-feedback-content" style="text-align: center; padding: 40px 20px;">
        <div class="feedback-emoji" style="font-size: 48px; margin-bottom: 16px;">${emojis[feedback]}</div>
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">${messages[feedback]}</h3>
        <p style="margin: 0; color: #64748b; font-size: 14px;">${subMessages[feedback]}</p>
      </div>
    `;
  }

  redirectToChromeWebStore() {
    // Close the popup first
    this.closeFeedbackPopup();
    
    // Redirect to Chrome Web Store reviews page
    const chromeWebStoreUrl = 'https://chromewebstore.google.com/detail/google-rank-tracker-geolo/endljcppflpjdhdpjidgelopcmmbbdbh/reviews';
    
    // Open in new tab
    window.open(chromeWebStoreUrl, '_blank');
  }

  closeFeedbackPopup() {
    const overlay = document.getElementById('gtrack-feedback-popup');
    if (overlay) {
      overlay.style.animation = 'gtrack-feedback-slide-out 0.2s ease-in forwards';
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }
  }

  // Optional: Send feedback to your analytics service
  async sendFeedbackToAnalytics(feedback) {
    try {
      // Example: Send to your backend
      // await fetch('https://your-analytics-endpoint.com/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     feedback: feedback,
      //     timestamp: Date.now(),
      //     extensionVersion: chrome.runtime.getManifest().version
      //   })
      // });
    } catch (error) {
      console.log('Error sending feedback to analytics:', error);
    }
  }

  // Method to manually trigger feedback (for testing)
  triggerFeedback() {
    this.showFeedbackPopup();
  }

  // Method to reset feedback data (for testing)
  async resetFeedbackData() {
    this.feedbackData = {
      hasShownFeedback: false,
      feedbackShownCount: 0,
      lastFeedbackShown: null,
      userFeedback: null,
      extensionUsageCount: 0,
      lastActiveDate: null
    };
    await this.saveFeedbackData();
  }

  // Method to clear only the feedback record (allow feedback popup to show again)
  async clearFeedbackRecord() {
    this.feedbackData.userFeedback = null;
    await this.saveFeedbackData();
    console.log('Feedback record cleared - popup can show again');
  }
}

// Initialize feedback system when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.gtrackFeedbackSystem = new FeedbackSystem();
  });
} else {
  window.gtrackFeedbackSystem = new FeedbackSystem();
}

// Add slide-out animation
const slideOutStyles = document.createElement('style');
slideOutStyles.textContent = `
  @keyframes gtrack-feedback-slide-out {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
  }
`;
document.head.appendChild(slideOutStyles);
