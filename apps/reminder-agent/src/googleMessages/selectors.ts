/**
 * Centralized Google Messages for Web selectors.
 *
 * IMPORTANT: Google Messages Web is an Angular app with obfuscated classes and
 * NO stable data-testids. These selectors target roles, aria-labels and visible
 * text, which survive redesigns better than CSS classes — but they CAN still
 * break when Google ships a UI change. Keep every selector here so a fix is a
 * one-file change. Each entry lists ordered fallbacks (first match wins).
 */
export const GM_URL = 'https://messages.google.com/web/';

export const selectors = {
  /** Present only when the phone is paired and the app is ready. */
  readyMarkers: [
    'mws-conversations-list',
    'a[href*="/web/conversations/"]',
    '[data-e2e-conversation-list]',
  ],

  /** QR code shown when NOT yet paired. */
  qrMarkers: ['mw-qr-code', 'img[alt*="QR"]', '[data-e2e-qr-code]'],

  /** "Start chat" button. */
  startChat: [
    'button[aria-label="Start chat"]',
    'a[aria-label="Start chat"]',
    'mws-fab-link',
    'text=Start chat',
  ],

  /** The "To" / recipient input where a phone number is typed. */
  recipientInput: [
    'input[aria-label*="type a name" i]',
    'input[aria-label*="phone number" i]',
    'input[placeholder*="name" i]',
    'input[type="text"]',
  ],

  /** The suggestion row that appears after typing a number — click to select. */
  recipientSuggestion: [
    'mws-contact-suggestion',
    '[data-e2e-contact-suggestion]',
    'div[role="option"]',
  ],

  /** "Send to <number>" chip / the create-conversation affordance. */
  sendToNumber: [
    'text=/^Send to /i',
    'mws-new-conversation-sub-header',
    'button[aria-label*="Send to" i]',
  ],

  /** The message compose textarea. */
  composeBox: [
    'textarea[aria-label*="message" i]',
    'textarea[placeholder*="message" i]',
    'div[contenteditable="true"][aria-label*="message" i]',
    'textarea',
  ],

  /** The Send button (enabled once text is entered). */
  sendButton: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send SMS"]',
    'button[data-e2e-send-button]',
    'mws-message-send-button button',
  ],

  /** A sent outgoing bubble containing our text (delivery evidence). */
  outgoingMessage: ['mws-message-wrapper.outgoing', '[data-e2e-is-outgoing="true"]'],

  /** The conversation header — used to verify WHICH recipient is open. */
  conversationHeader: [
    'mws-conversation-title',
    'h2[data-e2e-conversation-title]',
    '[data-e2e-conversation-title]',
    'mws-conversation-details-header',
  ],
};

export type SelectorKey = keyof typeof selectors;
