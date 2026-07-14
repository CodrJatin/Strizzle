"use client";

import * as React from "react";

/**
 * A custom hook to execute a callback when the Enter key is pressed in an open modal.
 * It ignores the keypress if the user is currently focused on an element that already
 * handles Enter natively (e.g. textareas, buttons, or elements with custom roles like comboboxes).
 */
export function useModalKeybinds(isOpen: boolean, onSubmit: () => void) {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const activeEl = document.activeElement;
        
        // Skip submission if focused on elements that handle Enter natively
        if (
          activeEl &&
          (activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "BUTTON" ||
            activeEl.hasAttribute("contenteditable") ||
            activeEl.closest("[role='combobox']") ||
            activeEl.closest("[role='listbox']"))
        ) {
          return;
        }

        e.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onSubmit]);
}
