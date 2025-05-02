import React from 'react';
import { TFunction } from 'i18next';
import data from '@emoji-mart/data';
import i18n from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';
import { BytemdPlugin } from 'bytemd';
import { createRoot } from 'react-dom/client';
import { icons } from '../icons';

const handleClick = (event: Event) => {
  event.stopPropagation();
  event.preventDefault();

  const el = document.querySelector('.emoji-container');

  if (el && !el.contains(event.target as HTMLElement)) {
    // Close the emoji picker
    el.className = 'emoji-container hidden';
    document.removeEventListener('click', handleClick);
  }
};

type EmojiSelectData = {
  native?: string;
  [key: string]: unknown;
};

interface EditorElement extends HTMLElement {
  offsetLeft: number;
  getBoundingClientRect(): DOMRect;
}

interface EmojiPluginOptions {
  t?: TFunction;
}

export const emoji = (options?: EmojiPluginOptions): BytemdPlugin => {
  // Get the translation function from options or import from i18next
  const { t } = options || {};

  // Use the provided t function or get a default one
  const getTranslation = (key: string) => {
    if (t) return t(key);
    // Fallback to default label if no translation function provided
    return key.split('.').pop() || key;
  };

  return {
    editorEffect: (ctx) => {
      const el = (
        <Picker
          i18n={i18n}
          data={data}
          onEmojiSelect={(c: EmojiSelectData) => {
            if (c?.native) {
              ctx.editor.replaceSelection(c?.native);
              // Hide the emoji picker after selection
              const container = document.querySelector('.emoji-container');
              if (container) {
                container.className = 'emoji-container hidden';
                document.removeEventListener('click', handleClick);
              }
            }
          }}
        />
      );

      // Create and position the emoji container
      const targetEl = document.createElement('div');
      targetEl.className = 'emoji-container hidden';
      targetEl.style.position = 'absolute';
      targetEl.style.zIndex = '1050';

      // Find the action element that triggers the emoji picker
      const actionEl = ctx.root.querySelector(`div[bytemd-tippy-path="18"]`) as EditorElement;

      if (actionEl) {
        // Insert the picker right after the action element in the DOM for accessibility
        if (actionEl.parentNode) {
          actionEl.parentNode.insertBefore(targetEl, actionEl.nextSibling);
        } else {
          // Fallback to body if we can't find the parent
          document.body.appendChild(targetEl);
        }
      } else {
        // Fallback if we can't find the action element
        document.body.appendChild(targetEl);
      }

      // Create root using React 18's API
      const root = createRoot(targetEl);
      root.render(el);

      // Store reference to the container for cleanup
      return () => {
        // Only attempt removal if the element is still attached to the DOM
        if (targetEl.parentNode) {
          // Unmount React component first
          root.unmount();
          // Then remove the container element
          targetEl.parentNode.removeChild(targetEl);
        }
      };
    },
    actions: [
      {
        title: getTranslation('editor.emoji.title'),
        icon: icons.emoji,
        handler: {
          type: 'action',
          click: ({ root }) => {
            const el = document.querySelector('.emoji-container');

            if (el) {
              // Close any other open emoji pickers first
              const allPickers = document.querySelectorAll('.emoji-container:not(.hidden)');
              allPickers.forEach((picker) => {
                if (picker !== el) {
                  picker.classList.add('hidden');
                }
              });

              if (el.classList.contains('hidden')) {
                // Update position based on the button's position
                const actionEl = root.querySelector(`div[bytemd-tippy-path="18"]`) as EditorElement;
                if (actionEl) {
                  // Get toolbar position
                  const toolbarRect = root
                    .querySelector('.bytemd-toolbar')
                    ?.getBoundingClientRect();
                  if (toolbarRect) {
                    // Set position relative to the viewport
                    (el as HTMLElement).style.position = 'fixed';
                    (el as HTMLElement).style.left = `${actionEl.getBoundingClientRect().left}px`;
                    (el as HTMLElement).style.top = `${toolbarRect.bottom + 5}px`;
                    // Important: Add appendTo option to resolve the Tippy.js warning
                    (el as HTMLElement).setAttribute('data-tippy-root', 'true');
                  }
                }

                // Add event listener to close on outside click
                setTimeout(() => {
                  document.addEventListener('click', handleClick);
                }, 100);
                el.classList.remove('hidden');
              } else {
                document.removeEventListener('click', handleClick);
                el.classList.add('hidden');
              }
            }
          },
        },
      },
    ],
  };
};
