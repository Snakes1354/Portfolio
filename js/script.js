const pageSections = document.querySelectorAll("#homepage, .page-section");
const navigationLinks = document.querySelectorAll(".site-nav .nav-link");

if ("IntersectionObserver" in window) {
  const visibility = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      visibility.set(entry.target.id, entry.intersectionRatio);
    });

    const activeSection = [...visibility.entries()]
      .filter(([, ratio]) => ratio >= 0.35)
      .sort((first, second) => second[1] - first[1])[0];

    if (!activeSection) {
      return;
    }

    navigationLinks.forEach((link) => {
      const isCurrent = link.hash === `#${activeSection[0]}`;
      link.classList.toggle("is-current", isCurrent);

      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }, {
    threshold: [0, 0.35, 0.5, 0.75, 1],
  });

  pageSections.forEach((section) => observer.observe(section));
}