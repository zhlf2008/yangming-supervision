import * as IconSet from '../src/icons/icons.js?v=2';

function hydrateIcon(element) {
  if (!element || element.dataset.iconReady === 'true') return;
  const svg = IconSet[element.dataset.icon];
  if (!svg) return;
  element.innerHTML = svg;
  element.dataset.iconReady = 'true';
  if (!element.hasAttribute('aria-label')) element.setAttribute('aria-hidden', 'true');
}

function prepareLegacyControls(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('.back-btn:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'ChevronLeftIcon';
    if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', '返回');
  });
  scope.querySelectorAll('.datepicker-trigger').forEach((element) => {
    if (element.querySelector('.datepicker-runtime-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'datepicker-runtime-icon';
    icon.dataset.icon = 'CalendarIcon';
    element.appendChild(icon);
  });
  scope.querySelectorAll('.collapse-arrow:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'ChevronRightIcon';
  });
  scope.querySelectorAll('.bigclass-arrow:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'ChevronRightIcon';
  });
  scope.querySelectorAll('.empty-state-icon:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'InfoIcon';
  });
  scope.querySelectorAll('.daban-card-icon:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'CalendarIcon';
  });
  scope.querySelectorAll('.menu-item-icon.logout:not([data-icon])').forEach((element) => {
    element.dataset.icon = 'LockIcon';
  });
  scope
    .querySelectorAll(
      '.schedule-head, .course-summary > summary, .course-editor-toggle, .course-picker-trigger, .course-group > summary'
    )
    .forEach((element) => {
      if (element.querySelector(':scope > .details-runtime-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'details-runtime-icon';
      icon.dataset.icon = 'ChevronRightIcon';
      element.appendChild(icon);
    });
}

function prepareAccessibility(root) {
  const scope = root && root.querySelectorAll ? root : document;

  scope.querySelectorAll('label:not([for])').forEach((label) => {
    const container = label.closest('.form-item, .input-group, .org-group, .form-group');
    const control = container?.querySelector('input, select, textarea');
    if (!control) return;
    if (!control.id) control.id = `field-${Math.random().toString(36).slice(2, 10)}`;
    label.htmlFor = control.id;
  });

  scope.querySelectorAll('.modal-overlay, .modal').forEach((dialog) => {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = dialog.querySelector('.modal-title, h2, h3');
    if (title) {
      if (!title.id) title.id = `dialog-${Math.random().toString(36).slice(2, 10)}`;
      dialog.setAttribute('aria-labelledby', title.id);
    }
  });

  scope.querySelectorAll('button[title]:not([aria-label]), a[title]:not([aria-label])').forEach((control) => {
    control.setAttribute('aria-label', control.title);
  });
}

function hydrate(root) {
  prepareLegacyControls(root);
  prepareAccessibility(root);
  if (root instanceof Element && root.matches('[data-icon]')) hydrateIcon(root);
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-icon]').forEach(hydrateIcon);
}

hydrate(document);

new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (node instanceof Element) hydrate(node);
    });
  });
}).observe(document.documentElement, { childList: true, subtree: true });
