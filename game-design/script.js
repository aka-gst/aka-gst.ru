if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.06, rootMargin: '0px 0px -12px 0px' });

  for (const el of document.querySelectorAll('.reveal')) observer.observe(el);
} else {
  for (const el of document.querySelectorAll('.reveal')) el.classList.add('in');
}
