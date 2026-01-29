const THEME_STORAGE_KEY = 'preferred-theme';
const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
let navLinkElements = [];
let sectionObserver;
let currentSectionId;
let contactModalElement;
let modalFocusables = [];
let lastFocusedElement;
let faqModalElement;
let faqFocusables = [];
let lastFaqFocusedElement;

async function loadSiteData() {
  try {
    const response = await fetch('data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }
    const data = await response.json();
    hydratePage(data);
  } catch (error) {
    console.error('Unable to hydrate page from data.json', error);
  }
}

function hydratePage(data) {
  if (!data || typeof data !== 'object') {
    return;
  }
  populateProfile(data.profile);
  populateNavigation(data.navigation, data.navigationCta);
  populateSocialLinks(data.socialLinks);
  populateAbout(data.about?.paragraphs);
  populateDevelopments(data.developments);
  populateMediaArticles(data.mediaArticles);
  populateFaqs(data.faqs);
  populateFooter(data.footer);
  setupFaqModal();
  setupScrollSpy();
}

function setText(id, value) {
  if (value === undefined || value === null) {
    return;
  }
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function populateProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') {
    return;
  }
  if ('name' in profile) {
    const nameNode = document.getElementById('profile-name');
    if (nameNode) {
      nameNode.innerHTML = profile.name;
    }
  }
  if ('title' in profile) {
    setText('profile-title', profile.title);
  }
  if ('summary' in profile) {
    setText('profile-summary', profile.summary);
  }
}

function populateNavigation(links = [], cta = {}) {
  const container = document.getElementById('nav-links');
  if (container && isNonEmptyArray(links)) {
    container.innerHTML = '';
    links.forEach((link) => {
      if (!link?.label) {
        return;
      }
      if (link.attribute === 'data-faq-trigger') {
        const button = document.createElement('button');
        button.className = 'nav-link hover:text-primary transition-colors bg-transparent border-0 p-0';
        button.type = 'button';
        button.textContent = link.label;
        button.setAttribute('data-faq-trigger', '');
        container.appendChild(button);
        return;
      }

      const anchor = document.createElement('a');
      anchor.className = 'nav-link hover:text-primary transition-colors';
      anchor.href = link.href || '#';
      anchor.textContent = link.label;
      if (link.attribute?.startsWith('data-')) {
        anchor.setAttribute(link.attribute, '');
      }
      container.appendChild(anchor);
    });
    enhanceNavLinks(Array.from(container.querySelectorAll('a')));
  }

  const ctaButton = document.getElementById('nav-cta');
  if (ctaButton) {
    if (cta?.label) {
      ctaButton.textContent = cta.label;
    }
    if (!ctaButton.hasAttribute('type')) {
      ctaButton.setAttribute('type', 'button');
    }
    ctaButton.dataset.ctaHref = cta?.href || '';
  }
}

function populateSocialLinks(links = []) {
  const container = document.getElementById('social-links');
  if (!container || !isNonEmptyArray(links)) {
    return;
  }
  container.innerHTML = '';
  links.forEach((link) => {
    if (!link?.label) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.className = 'social-icon-link';
    anchor.href = link.href || '#';
    anchor.target = link.href?.startsWith('http') ? '_blank' : '_self';
    anchor.rel = anchor.target === '_blank' ? 'noreferrer noopener' : '';
    anchor.setAttribute('aria-label', link.label);

    const icon = document.createElement('i');
    icon.className = `${link.iconClass || 'fa-solid fa-link'} social-icon`;

    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = link.label;

    anchor.append(srText, icon);
    container.appendChild(anchor);
  });
}

function populateAbout(paragraphs = []) {
  const container = document.getElementById('about-content');
  if (!container || !isNonEmptyArray(paragraphs)) {
    return;
  }
  container.innerHTML = '';
  paragraphs.forEach((text) => {
    if (!text) {
      return;
    }
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    container.appendChild(paragraph);
  });
}


function populateDevelopments(developments = []) {
  const grid = document.getElementById('developments-grid');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  if (!isNonEmptyArray(developments)) {
    grid.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">New tools are cooking in the lab.</p>';
    return;
  }
  developments.slice(0, 3).forEach((app) => {
    if (!app?.name) {
      return;
    }
    const banner = document.createElement('a');
    banner.className = 'development-banner';
    banner.href = app.href || '#';
    banner.target = app.href?.startsWith('http') ? '_blank' : '_self';
    banner.rel = banner.target === '_blank' ? 'noreferrer noopener' : '';
    banner.setAttribute('aria-label', app.name);
    banner.style.backgroundImage = `url("${resolveMetaImage(app)}")`;

    grid.appendChild(banner);
  });
}

function populateMediaArticles(entries = []) {
  const container = document.getElementById('media-list');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!isNonEmptyArray(entries)) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Articles are being curated.</p>';
    return;
  }
  entries.forEach((entry) => {
    if (!entry?.title) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.className = 'media-article-card flex items-center gap-4 p-4 group border border-gray-200 dark:border-gray-800 rounded-2xl transition-colors hover:border-primary';
    anchor.href = entry.href || '#';
    anchor.target = entry.href?.startsWith('http') ? '_blank' : '_self';
    anchor.rel = anchor.target === '_blank' ? 'noreferrer noopener' : '';

    const column = document.createElement('div');
    column.className = 'flex flex-col flex-1';

    const leadingIcon = document.createElement('i');
    leadingIcon.className = `${entry.iconClass || 'fa-solid fa-newspaper'} text-3xl text-slate-400 group-hover:text-primary transition-colors`; 

    const platform = document.createElement('span');
    platform.className = 'text-xs font-bold text-primary uppercase tracking-widest mb-1';
    platform.textContent = entry.platform || '';

    const title = document.createElement('span');
    title.className = 'text-lg font-medium group-hover:translate-x-1 transition-transform';
    title.textContent = entry.title;

    column.append(platform, title);

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-gray-400 group-hover:text-primary';
    icon.textContent = 'open_in_new';

    anchor.append(leadingIcon, column, icon);
    container.appendChild(anchor);
  });
}

function populateFaqs(faqs = []) {
  const container = document.getElementById('faq-content');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!isNonEmptyArray(faqs)) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">I am collecting new guidance.</p>';
    return;
  }
  faqs.forEach((faq) => {
    if (!faq?.question) {
      return;
    }
    const article = document.createElement('article');
    article.className = 'faq-item space-y-3';

    const questionButton = document.createElement('button');
    questionButton.type = 'button';
    questionButton.className = 'faq-question text-left text-gray-900 dark:text-gray-50';
    questionButton.setAttribute('aria-expanded', 'false');

    const questionText = document.createElement('span');
    questionText.textContent = faq.question;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined faq-icon text-primary';
    icon.textContent = 'expand_more';

    questionButton.append(questionText, icon);

    const answer = document.createElement('div');
    answer.className = 'faq-answer text-sm text-gray-600 dark:text-gray-300 space-y-2';
    answer.hidden = true;

    if (isNonEmptyArray(faq.answers)) {
      const list = document.createElement('ul');
      list.className = 'list-disc pl-5 space-y-1';
      faq.answers.forEach((answerText) => {
        if (!answerText) {
          return;
        }
        const item = document.createElement('li');
        item.textContent = answerText;
        list.appendChild(item);
      });
      answer.appendChild(list);
    }

    questionButton.addEventListener('click', () => {
      const expanded = questionButton.getAttribute('aria-expanded') === 'true';
      questionButton.setAttribute('aria-expanded', String(!expanded));
      answer.hidden = expanded;
      article.classList.toggle('faq-item-open', !expanded);
    });

    article.append(questionButton, answer);
    container.appendChild(article);
  });
}

function populateFooter(footer = {}) {
  if (footer && typeof footer === 'object') {
    if ('copy' in footer) {
      setText('footer-copy', footer.copy);
    }
    if ('email' in footer) {
      setText('footer-email', footer.email);
    }
  }

  const container = document.getElementById('footer-links');
  if (!container || !isNonEmptyArray(footer?.links)) {
    return;
  }
  container.innerHTML = '';
  footer.links.forEach((link) => {
    if (!link?.label) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.className = 'hover:text-primary transition-colors flex items-center justify-center text-lg';
    anchor.href = link.href || '#';
    anchor.target = link.href?.startsWith('http') ? '_blank' : '_self';
    anchor.rel = anchor.target === '_blank' ? 'noreferrer noopener' : '';
    anchor.setAttribute('aria-label', link.label);

    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = link.label;

    const icon = document.createElement('i');
    icon.className = link.iconClass || 'fa-solid fa-link';

    anchor.append(srText, icon);
    container.appendChild(anchor);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  enhanceNavLinks();
  setupScrollSpy();
  setupContactModal();
  setupFaqModal();
  loadSiteData();
});

function setupScrollSpy() {
  if (!navLinkElements.length) {
    return;
  }

  if (sectionObserver) {
    sectionObserver.disconnect();
  }

  const sections = navLinkElements
    .map((link) => document.getElementById(link.dataset.sectionId))
    .filter(Boolean);

  if (!sections.length) {
    return;
  }

  sectionObserver = new IntersectionObserver(handleSectionIntersection, {
    root: null,
    threshold: 0.1,
    rootMargin: '-40% 0px -45% 0px'
  });

  sections.forEach((section) => sectionObserver.observe(section));
  setActiveNav(sections[0].id);
}

function handleSectionIntersection(entries) {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

  if (!visible.length) {
    return;
  }

  const sectionId = visible[0].target.id;
  setActiveNav(sectionId);
}

function setActiveNav(sectionId) {
  if (!sectionId) {
    currentSectionId = null;
    navLinkElements.forEach((link) => {
      link.classList.remove('nav-link-active');
    });
    return;
  }

  if (sectionId === currentSectionId) {
    return;
  }

  currentSectionId = sectionId;
  navLinkElements.forEach((link) => {
    const isActive = link.dataset.sectionId === sectionId;
    link.classList.toggle('nav-link-active', isActive);
  });
}

function enhanceNavLinks(anchors) {
  const container = document.getElementById('nav-links');
  if (!container) {
    navLinkElements = [];
    return;
  }

  const resolvedAnchors = anchors || Array.from(container.querySelectorAll('a'));
  navLinkElements = [];

  resolvedAnchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    anchor.classList.add('nav-link');
    if (!href.startsWith('#') || href.length <= 1) {
      return;
    }
    const targetId = href.slice(1);
    anchor.dataset.sectionId = targetId;
    if (anchor.dataset.enhanced !== 'true') {
      anchor.dataset.enhanced = 'true';
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    navLinkElements.push(anchor);
  });
}

function setupContactModal() {
  contactModalElement = document.getElementById('contact-modal');
  const triggers = document.querySelectorAll('[data-contact-trigger]');
  if (!contactModalElement || !triggers.length) {
    return;
  }

  triggers.forEach((trigger) => {
    if (trigger.dataset.modalBound === 'true') {
      return;
    }
    trigger.dataset.modalBound = 'true';
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openContactModal();
    });
  });

  contactModalElement.querySelectorAll('[data-contact-dismiss]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      closeContactModal();
    });
  });

  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', handleContactFormSubmit);
  }
}

function openContactModal() {
  if (!contactModalElement) {
    return;
  }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  contactModalElement.classList.remove('hidden');
  contactModalElement.setAttribute('aria-hidden', 'false');
  refreshModalFocusables();
  (modalFocusables[0] || contactModalElement).focus();
  document.addEventListener('keydown', handleModalKeydown);
}

function closeContactModal() {
  if (!contactModalElement) {
    return;
  }
  contactModalElement.classList.add('hidden');
  contactModalElement.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', handleModalKeydown);
  const feedback = document.getElementById('contact-feedback');
  if (feedback) {
    feedback.textContent = '';
  }
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function handleModalKeydown(event) {
  if (!isContactModalOpen()) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeContactModal();
    return;
  }
  if (event.key !== 'Tab' || modalFocusables.length === 0) {
    return;
  }

  const firstFocusable = modalFocusables[0];
  const lastFocusable = modalFocusables[modalFocusables.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }
  } else if (document.activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
}

function refreshModalFocusables() {
  if (!contactModalElement) {
    modalFocusables = [];
    return;
  }
  modalFocusables = Array.from(contactModalElement.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) => {
    return (
      !element.hasAttribute('disabled') &&
      element.tabIndex !== -1 &&
      (element.offsetParent !== null || element.getClientRects().length > 0)
    );
  });
}

function isContactModalOpen() {
  return Boolean(contactModalElement && !contactModalElement.classList.contains('hidden'));
}

function handleContactFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.getElementById('contact-feedback');
  if (feedback) {
    feedback.textContent = 'Thanks for reaching out! I will respond soon.';
  }
  form.reset();
}

function setupFaqModal() {
  faqModalElement = document.getElementById('faq-modal');
  const triggers = document.querySelectorAll('[data-faq-trigger]');
  if (!faqModalElement || !triggers.length) {
    return;
  }

  triggers.forEach((trigger) => {
    if (trigger.dataset.modalBound === 'true') {
      return;
    }
    trigger.dataset.modalBound = 'true';
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openFaqModal();
    });
  });

  faqModalElement.querySelectorAll('[data-faq-dismiss]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      closeFaqModal();
    });
  });
}

function openFaqModal() {
  if (!faqModalElement) {
    return;
  }
  lastFaqFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  faqModalElement.classList.remove('hidden');
  faqModalElement.setAttribute('aria-hidden', 'false');
  refreshFaqFocusables();
  (faqFocusables[0] || faqModalElement).focus();
  document.addEventListener('keydown', handleFaqModalKeydown);
}

function closeFaqModal() {
  if (!faqModalElement) {
    return;
  }
  faqModalElement.classList.add('hidden');
  faqModalElement.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', handleFaqModalKeydown);
  if (lastFaqFocusedElement) {
    lastFaqFocusedElement.focus();
    lastFaqFocusedElement = null;
  }
}

function handleFaqModalKeydown(event) {
  if (!isFaqModalOpen()) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeFaqModal();
    return;
  }
  if (event.key !== 'Tab' || faqFocusables.length === 0) {
    return;
  }

  const firstFocusable = faqFocusables[0];
  const lastFocusable = faqFocusables[faqFocusables.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }
  } else if (document.activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
}

function refreshFaqFocusables() {
  if (!faqModalElement) {
    faqFocusables = [];
    return;
  }
  faqFocusables = Array.from(faqModalElement.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) => {
    return (
      !element.hasAttribute('disabled') &&
      element.tabIndex !== -1 &&
      (element.offsetParent !== null || element.getClientRects().length > 0)
    );
  });
}

function isFaqModalOpen() {
  return Boolean(faqModalElement && !faqModalElement.classList.contains('hidden'));
}


function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const startingTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(startingTheme);

  const toggleButton = document.getElementById('theme-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    });
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  root.classList.remove('dark', 'light');
  root.classList.add(normalizedTheme);
  updateThemeToggle(normalizedTheme);
}

function updateThemeToggle(theme) {
  const toggleButton = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  const showLight = theme === 'dark';

  if (toggleButton) {
    toggleButton.setAttribute('aria-pressed', showLight ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', showLight ? 'Switch to light mode' : 'Switch to dark mode');
  }

  if (icon) {
    icon.textContent = showLight ? 'light_mode' : 'dark_mode';
  }
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function resolveMetaImage(app = {}) {
  if (app.metaImage) {
    return app.metaImage;
  }
  if (app.image) {
    return app.image;
  }
  return 'profile.jpg';
}
