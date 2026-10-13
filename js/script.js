const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('main section');
const homeLink = document.querySelector('.home-button');
const homepageButton = document.querySelector('.home-link');

homepageButton.addEventListener('click', () => {
  clearCurrentLink();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

const setCurrentLink = (sectionId) => {
  homeLink.classList.remove('is-current');
  homeLink.removeAttribute('aria-current');

  navLinks.forEach((link) => {
    const isCurrent = link.getAttribute('href') === `#${sectionId}`;
    link.classList.toggle('is-current', isCurrent);

    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const clearCurrentLink = () => {
  homeLink.classList.add('is-current');
  homeLink.setAttribute('aria-current', 'page');

  navLinks.forEach((link) => {
    link.classList.remove('is-current');
    link.removeAttribute('aria-current');
  });
};

const syncNavFromHash = () => {
  const hash = window.location.hash.replace('#', '');

  if (!hash || hash === 'home') {
    clearCurrentLink();
    return;
  }

  setCurrentLink(hash);
};

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length > 0) {
        const targetId = visible[0].target.id;
        if (targetId === 'home') {
          clearCurrentLink();
        } else {
          setCurrentLink(targetId);
        }
      }
    },
    {
      threshold: [0.3, 0.45, 0.7, 1],
      rootMargin: '-8% 0px -12% 0px',
    }
  );

  sections.forEach((section) => observer.observe(section));
} else {
  syncNavFromHash();
}

window.addEventListener('hashchange', syncNavFromHash);

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const targetId = (link.getAttribute('href') || '').replace('#', '');
    if (!targetId) return;

    if (targetId === 'home') {
      clearCurrentLink();
    } else {
      setCurrentLink(targetId);
    }
  });
});

syncNavFromHash();
