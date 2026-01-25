// index.js

// animation simple au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach((btn, index) => {
    btn.style.opacity = 0;
    btn.style.transform = 'translateY(20px)';
    setTimeout(() => {
      btn.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      btn.style.opacity = 1;
      btn.style.transform = 'translateY(0)';
    }, 100 * index);
  });
});

