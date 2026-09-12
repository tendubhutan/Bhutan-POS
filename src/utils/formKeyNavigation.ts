import React from 'react';

/**
 * Utility to provide seamless keyboard navigation across form fields in Master forms & Modals.
 * - Enter / Down Arrow -> Moves focus to next field box.
 * - Shift+Enter / Up Arrow -> Moves focus to previous field box.
 * - Enter on the last field or Save button -> Triggers form save.
 * - F2 / Ctrl+A -> Triggers form save immediately from any field box.
 * - Escape -> Closes form/modal.
 */
export function handleFormKeyDown(
  e: React.KeyboardEvent<HTMLElement> | KeyboardEvent,
  containerEl: HTMLElement | null,
  onSave?: () => void,
  onClose?: () => void
) {
  if (!containerEl) return;

  const key = e.key;

  // F2 or Ctrl+A for Quick Save from any field
  if (key === 'F2' || e.code === 'F2' || ((e.ctrlKey || e.metaKey) && (key === 'a' || key === 'A' || e.code === 'KeyA'))) {
    if (onSave) {
      e.preventDefault();
      e.stopPropagation();
      if ('stopImmediatePropagation' in e && typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      onSave();
      return;
    }
  }

  // Escape to Close modal
  if (key === 'Escape') {
    if (onClose) {
      e.preventDefault();
      e.stopPropagation();
      if ('stopImmediatePropagation' in e && typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      onClose();
      return;
    }
  }

  const isEnter = key === 'Enter';
  const isUp = key === 'ArrowUp';
  const isDown = key === 'ArrowDown';

  if (!isEnter && !isUp && !isDown) return;

  const active = document.activeElement as HTMLElement | null;
  if (!active || !containerEl.contains(active)) return;

  const tag = active.tagName.toLowerCase();

  // Allow standard multiline Enter in textareas unless Shift is pressed
  if (tag === 'textarea' && isEnter && !e.shiftKey) {
    return;
  }

  // Allow standard dropdown selection using Up/Down arrows in select elements
  if (tag === 'select' && (isUp || isDown)) {
    return;
  }

  // Collect all focusable elements inside the modal container
  const focusables = Array.from(
    containerEl.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => {
    // Must be visible and interactive
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });

  if (focusables.length === 0) return;

  const currentIndex = focusables.indexOf(active);
  if (currentIndex === -1) return;

  let nextIndex = -1;

  if (isEnter) {
    if (e.shiftKey) {
      // Shift+Enter -> Previous field
      nextIndex = currentIndex - 1;
    } else {
      // Enter -> Next field or Save
      const isSubmitBtn = tag === 'button' && (
        active.getAttribute('type') === 'submit' ||
        active.innerText.toLowerCase().includes('save') ||
        active.innerText.toLowerCase().includes('update') ||
        active.innerText.toLowerCase().includes('create')
      );

      if (isSubmitBtn) {
        if (onSave) {
          e.preventDefault();
          e.stopPropagation();
          onSave();
          return;
        }
      } else {
        // Check if current element is the last interactive element before action buttons
        const nonBtnFocusables = focusables.filter(el => el.tagName.toLowerCase() !== 'button');
        const isLastNonBtn = nonBtnFocusables.length > 0 && nonBtnFocusables[nonBtnFocusables.length - 1] === active;

        if (currentIndex === focusables.length - 1 || isLastNonBtn) {
          // If at the end of fields, focus the primary Save button or trigger Save
          const saveBtn = focusables.find(el => 
            el.tagName.toLowerCase() === 'button' && 
            (el.getAttribute('type') === 'submit' || el.innerText.toLowerCase().includes('save') || el.innerText.toLowerCase().includes('update') || el.innerText.toLowerCase().includes('create'))
          );

          if (saveBtn && active !== saveBtn) {
            e.preventDefault();
            e.stopPropagation();
            saveBtn.focus();
            return;
          } else if (onSave) {
            e.preventDefault();
            e.stopPropagation();
            onSave();
            return;
          }
        } else {
          nextIndex = currentIndex + 1;
        }
      }
    }
  } else if (isUp) {
    nextIndex = currentIndex - 1;
  } else if (isDown) {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex >= 0 && nextIndex < focusables.length) {
    e.preventDefault();
    e.stopPropagation();
    const nextEl = focusables[nextIndex];
    nextEl.focus();
    if (nextEl instanceof HTMLInputElement) {
      if (['text', 'number', 'password', 'search', 'tel', 'url'].includes(nextEl.type)) {
        nextEl.select();
      }
    }
  }
}

/**
 * Automatically places focus into the first input field of a form container when opened.
 */
export function focusFirstFormInput(containerEl: HTMLElement | null) {
  if (!containerEl) return;
  setTimeout(() => {
    const firstInput = containerEl.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
    );
    if (firstInput) {
      firstInput.focus();
      if (firstInput instanceof HTMLInputElement) {
        if (['text', 'number', 'password', 'search', 'tel', 'url'].includes(firstInput.type)) {
          firstInput.select();
        }
      }
    }
  }, 60);
}
