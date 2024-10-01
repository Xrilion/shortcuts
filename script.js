// Constants
const DEFAULT_SHORTCUTS = [
    { name: "Notion", url: "https://www.notion.so", icon: "favicons/Notion.png" },
    { name: "YouTube", url: "https://www.youtube.com", icon: "favicons/Youtube.png" },
    { name: "ChatGPT", url: "https://chatgpt.com", icon: "favicons/ChatGPT.png" },
    { name: "GitHub", url: "https://github.com", icon: "favicons/Github.png" },
    { name: "Keep", url: "https://keep.google.com", icon: "favicons/Keep.png" },
    { name: "Twitter", url: "https://twitter.com", icon: "favicons/Twitter.png" },
    { name: "LinkedIn", url: "https://www.linkedin.com", icon: "favicons/LinkedIn.png" },
  ];
  
  const ICONS = {
    LIGHT: `<svg class="light-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="m18.364 5.636-.707.707"/><path d="m6.343 17.657-.707.707"/><path d="m5.636 5.636.707.707"/><path d="m17.657 17.657.707.707"/></svg>`,
    DARK: `<svg class="dark-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`,
  };
  
  // State
  let shortcuts = [];
  let filteredShortcuts = [];
  let swapy;
  let isSearchActive = false;
  let isModalOpen = false;
  let faviconCache;
  let isDragging = false;
  
  // Utility functions
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const isValidUrl = (url) => {
    const urlRegex = /^(?:(?:https?|ftp):\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s]*$/i;
    return urlRegex.test(url) && !url.endsWith('.') && !url.match(/^https?:\/\/(?:www\.)?[a-z0-9-]+$/i);
  };
  
  // Async functions
  const loadShortcuts = async () => (await chrome.storage.local.get(['shortcuts'])).shortcuts || [];
  const saveShortcuts = async () => await chrome.storage.local.set({ shortcuts });
  const loadThemePreference = async () => (await chrome.storage.local.get(['theme'])).theme || 'auto';
  const saveThemePreference = async (theme) => await chrome.storage.local.set({ theme });
  const loadFaviconCache = async () => {
    try {
      const response = await fetch('faviconCache.json');
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      return response.json();
    } catch (error) {
      console.error('Error loading favicon cache:', error);
    }
  };
  
  // Event handlers
  const handleSearch = () => {
    isSearchActive = !!$('.searchInput').value.trim();
    renderShortcuts();
  };
  
  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const searchQuery = $('.searchInput').value.trim();
      if (searchQuery) {
        const matchingShortcut = shortcuts.find(shortcut => shortcut.name.toLowerCase() === searchQuery.toLowerCase());
        if (!matchingShortcut) {
          openModal();
          $('#shortcut-name').value = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
          $('#shortcut-name').focus();
        }
      }
    }
  };
  
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const urlInput = $('#shortcut-url');
    const nameInput = $('#shortcut-name');
    const iconInput = $('#shortcut-icon');
    const index = form.dataset.index;
  
    let url = urlInput.value.trim();
    let name = nameInput.value.trim();
    const icon = iconInput.value.trim();
  
    urlInput.setCustomValidity('');
  
    if (!url) {
      urlInput.setCustomValidity('Empty URL?');
      urlInput.reportValidity();
      return;
    }
  
    if (!isValidUrl(url)) {
      urlInput.setCustomValidity('Wrong URL format.');
      urlInput.reportValidity();
      return;
    }
  
    url = url.startsWith('http') ? url : `https://${url}`;
    const normalizedUrl = url.replace(/\/$/, '');
  
    if (index === undefined && shortcuts.some(shortcut => shortcut.url.replace(/\/$/, '') === normalizedUrl)) {
      urlInput.setCustomValidity('Already exists.');
      urlInput.reportValidity();
      return;
    }
  
    if (!name) {
      const domain = new URL(url).hostname.replace('www.', '');
      name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
  
    const shortcut = { name, url: normalizedUrl, icon: (icon || fetchFavicon(url)).replace(/\/$/, '') };
  
    if (index !== undefined) {
      shortcuts[index] = shortcut;
      delete form.dataset.index;
    } else {
      shortcuts.push(shortcut);
    }
  
    await saveShortcuts();
    renderShortcuts();
    closeModal();
    form.reset();
  };
  
  const handleThemeSwitchClick = () => {
    const themeText = $('#theme-text');
    const currentTheme = themeText.textContent.toLowerCase();
    const newTheme = currentTheme === 'auto' ? 'dark' : currentTheme === 'dark' ? 'light' : 'auto';
    updateThemeDisplay(newTheme);
    applyTheme(newTheme);
    saveThemePreference(newTheme);
  };
  
  // Render functions
  const renderShortcuts = () => {
    const grid = $('#shortcut-grid');
    grid.innerHTML = '';
  
    const query = $('.searchInput').value.toLowerCase();
    filteredShortcuts = shortcuts.filter(shortcut => shortcut.name.toLowerCase().includes(query));
  
    filteredShortcuts.forEach((shortcut, index) => {
      grid.appendChild(createShortcutSlot(shortcut, index));
    });
  
    grid.appendChild(createAddShortcutElement());
  
    adjustVisibility();
    setupGridEventListeners();
    initializeSwapy();
  };
  
  const createShortcutSlot = (shortcut, index) => {
    const slotElement = document.createElement('div');
    slotElement.classList.add('shortcut-slot');
    slotElement.dataset.swapySlot = `slot-${index}`;
    slotElement.appendChild(createShortcutElement(shortcut, index));
    return slotElement;
  };
  
  const createShortcutElement = (shortcut, index) => {
    const shortcutElement = document.createElement('div');
    shortcutElement.classList.add('shortcut');
    shortcutElement.dataset.swapyItem = `item-${index}`;
    shortcutElement.innerHTML = `
      <div class="shortcut-actions">
        <button class="editBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button class="removeBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="shortcut-content">
        <img class="bg" src="${shortcut.icon}" alt="${shortcut.name}">
        <img class="favicon" src="${shortcut.icon}" alt="${shortcut.name}">
        <p>${shortcut.name}</p>
      </div>
    `;
  
    shortcutElement.querySelector('.editBtn').addEventListener('click', (event) => {
      event.stopPropagation();
      openEditModal(index);
    });
  
    shortcutElement.querySelector('.removeBtn').addEventListener('click', (event) => {
      event.stopPropagation();
      removeShortcut(index);
    });
  
    let mouseDownTime;
    let isLocalDragging = false;
  
    shortcutElement.addEventListener('mousedown', () => {
      mouseDownTime = new Date().getTime();
      isLocalDragging = false;
    });
  
    shortcutElement.addEventListener('mousemove', () => {
      isLocalDragging = true;
    });
  
    shortcutElement.addEventListener('mouseup', (event) => {
        if (event.button !== 0) return;
        const mouseUpTime = new Date().getTime();
        const clickDuration = mouseUpTime - mouseDownTime;
        if (clickDuration < 200 && !isLocalDragging && !isDragging) {
          if (!event.target.closest('.editBtn') && !event.target.closest('.removeBtn')) {
            window.open(shortcut.url, event.ctrlKey ? '_blank' : '_self');
          }
        }
        isLocalDragging = false;
      });
      
  
    shortcutElement.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });
  
    return shortcutElement;
  };
  
  const createAddShortcutElement = () => {
    const addShortcutElement = document.createElement('button');
    addShortcutElement.classList.add('shortcut', 'addShortcut');
    addShortcutElement.addEventListener('click', () => {
      const searchQuery = $('.searchInput').value.trim();
      openModal();
      if (searchQuery) {
        $('#shortcut-name').value = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
        $('#shortcut-name').focus();
      }
    });
    return addShortcutElement;
  };
  
  // Modal functions
  const openModal = () => {
    $('#add-shortcut-modal').style.display = 'block';
    $('#add-shortcut-modal').setAttribute('aria-hidden', 'false');
    isModalOpen = true;
    $('#shortcut-url').focus();
    $('.bottomLinks').classList.add('modal-open');
  };
  
  const closeModal = () => {
    $('#add-shortcut-modal').style.display = 'none';
    $('#add-shortcut-modal').setAttribute('aria-hidden', 'true');
    isModalOpen = false;
    clearFormFields();
    $('.bottomLinks').classList.remove('modal-open');
  };
  
  const clearFormFields = () => {
    $('#shortcut-form').reset();
    $('#modalTitle').textContent = 'Add Shortcut';
    delete $('#shortcut-form').dataset.index;
  };
  
  const openEditModal = (filteredIndex) => {
    const originalIndex = shortcuts.findIndex(shortcut => shortcut === filteredShortcuts[filteredIndex]);
    const shortcut = shortcuts[originalIndex];
    $('#shortcut-url').value = shortcut.url;
    $('#shortcut-name').value = shortcut.name;
    $('#shortcut-form').dataset.index = originalIndex;
    $('#modalTitle').textContent = 'Edit Shortcut';
    openModal();
  };
  
  // Theme functions
  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', theme === 'dark');
    root.classList.toggle('light-mode', theme === 'light');
  };
  
  const updateThemeDisplay = (theme) => {
    const themeIcon = $('#theme-icon');
    const themeText = $('#theme-text');
  
    themeText.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    themeIcon.innerHTML = theme === 'dark' ? ICONS.DARK : 
                          theme === 'light' ? ICONS.LIGHT : 
                          (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? ICONS.DARK : ICONS.LIGHT;
  };
  
  // Initialization
  const initializeApp = async () => {
    shortcuts = await loadShortcuts() || DEFAULT_SHORTCUTS;
    if (shortcuts.length === 0) {
      shortcuts = DEFAULT_SHORTCUTS;
      await saveShortcuts();
    }
    renderShortcuts();
    setupEventListeners();
    await initializeThemeSwitch();
    faviconCache = await loadFaviconCache();
  };
  
  const setupEventListeners = () => {
    $('.searchInput').addEventListener('input', handleSearch);
    $('.searchInput').addEventListener('keydown', handleSearchKeyDown);
    $('#shortcut-form').addEventListener('submit', handleFormSubmit);
    $('.cancelBtn').addEventListener('click', closeModal);
    $('#add-shortcut-modal').addEventListener('mousedown', (event) => {
      if (event.target === $('#add-shortcut-modal')) closeModal();
    });
    $('#shortcut-url').addEventListener('input', () => {
      $('#shortcut-url').setCustomValidity('');
    });
    $('#shortcut-form').setAttribute('novalidate', '');
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });
  };
  
  const initializeSwapy = () => {
    if (swapy) swapy.destroy();
  
    const container = $('#shortcut-grid');
    const slots = container.querySelectorAll('.shortcut-slot');
  
    if (isSearchActive || isModalOpen || slots.length === 0) return;
  
    swapy = Swapy.createSwapy(container, { 
      animation: 'dynamic',
      onDragStart: (event) => {
        event.draggedElement.style.backgroundColor = '';
        document.body.style.cursor = 'grabbing';
        isDragging = true;
      },
      onDrag: () => {
        if (isDragging) {
          document.body.style.cursor = 'grabbing';
        }
      },
      ondragend: (event) => {
        event.draggedElement.style.backgroundColor = '';
        document.body.style.cursor = '';
        isDragging = false;
      }
    });
  
    let lastSwapData = null;
  
    const captureFinalState = (event) => {
      if (event.button === 2) {container.addEventListener('contextmenu', (e) => e.preventDefault(), { once: true });}
      const slots = Array.from(container.querySelectorAll('.shortcut-slot'));
      const newShortcuts = slots.map((slot) => {
        const shortcutElement = slot.querySelector('.shortcut');
        const originalIndex = parseInt(shortcutElement.dataset.swapyItem.replace('item-', ''), 10);
        return shortcuts[originalIndex];
      });
  
      if (JSON.stringify(shortcuts) !== JSON.stringify(newShortcuts)) {
        shortcuts = newShortcuts;
        saveShortcuts();
        renderShortcuts();
      }
    };
  
    swapy.onSwap((event) => {
      if (JSON.stringify(lastSwapData) !== JSON.stringify(event.data)) {
        lastSwapData = event.data;
        container.addEventListener('mouseup', captureFinalState, { once: true });
        container.addEventListener('touchend', captureFinalState, { once: true });
      }
    });
  
    setupDragBehavior(container);
  };
  
  const setupDragBehavior = (container) => {
    let startX, startY, draggedShortcut, isDragging;
    const dragThreshold = 5;

    container.addEventListener('mousedown', (event) => {
    const shortcut = event.target.closest('.shortcut');
      if (shortcut) {
      event.preventDefault();
      startX = event.clientX;
      startY = event.clientY;
      draggedShortcut = shortcut;
      isDragging = false;
      }
    });
    document.addEventListener('mousemove', (event) => {
      if (draggedShortcut) {
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);

      if (deltaX > dragThreshold || deltaY > dragThreshold) {
      isDragging = true;
      if (!draggedShortcut.classList.contains('grabbing')) {
      draggedShortcut.classList.add('grabbing');
      draggedShortcut.style.backgroundColor = '';
      document.body.style.cursor = 'grabbing';
      }
    }}});
    document.addEventListener('mouseup', () => {
      if (draggedShortcut) {
      if (isDragging) {
      draggedShortcut.classList.remove('grabbing');
      document.body.style.cursor = '';
      }
      draggedShortcut = null;
      isDragging = false;
      }
    });
  };
  
  const initializeThemeSwitch = async () => {
    const themePreference = await loadThemePreference();
    updateThemeDisplay(themePreference);
    $('#theme-switch').addEventListener('click', handleThemeSwitchClick);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.addEventListener('change', (e) => {
      if (themePreference.toLowerCase() === 'auto') {
        updateThemeDisplay(e.matches ? 'dark' : 'light');
      }
    });
  };
  
  // Helper functions
  const adjustVisibility = () => {
    const addShortcut = $('#shortcut-grid').querySelector('.addShortcut');
    addShortcut.style.display = filteredShortcuts.length === 4 || filteredShortcuts.length === 8 ? 'none' : 'block';
  };
  
  const setupGridEventListeners = () => {
    const gridCont = $('.gridCont');
    gridCont.addEventListener('mouseenter', () => {
      $('#shortcut-grid').querySelector('.addShortcut').style.display = 'block';
    });
    gridCont.addEventListener('mouseleave', adjustVisibility);
  };
  
  const removeShortcut = async (filteredIndex) => {
    const originalIndex = shortcuts.findIndex(shortcut => shortcut === filteredShortcuts[filteredIndex]);
    shortcuts.splice(originalIndex, 1);
    await saveShortcuts();
    renderShortcuts();
  };
  
  const fetchFavicon = (url) => {
    if (!faviconCache) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    const urlObj = new URL(url);
    const mainDomain = urlObj.hostname;
    const baseDomainUrl = `https://${mainDomain}`;
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment !== '');
    let baseUrl = baseDomainUrl;
    for (let i = 0; i < Math.min(3, pathSegments.length); i++) {
      baseUrl += `/${pathSegments[i]}`;
      if (faviconCache[baseUrl]) {
        return faviconCache[baseUrl];
      }
    }
    return faviconCache[baseDomainUrl] || `https://www.google.com/s2/favicons?domain=${baseDomainUrl}`;
  };
  
  // Initialize the app
  window.onload = initializeApp;