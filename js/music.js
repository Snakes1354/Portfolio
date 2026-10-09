(() => {
  const card = document.querySelector('.now-playing');
  const audio = card && card.querySelector('.now-playing-audio');
  if (!audio) return;

  const SECRET = 'juice';

  const toggleButton = card.querySelector('.now-playing-toggle');
  const closeButton = card.querySelector('.now-playing-close');
  const label = card.querySelector('.now-playing-label');
  const bar = card.querySelector('.now-playing-bar span');
  const timeLabel = card.querySelector('.now-playing-time');
  const durationLabel = card.querySelector('.now-playing-duration');
  let typed = '';

  audio.volume = 0.6;

  const formatTime = (seconds) => {
    const whole = Math.floor(seconds || 0);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };

  const play = () => {
    card.classList.add('is-open');
    audio.play().catch(() => {
      // The browser refused to start audio; the card stays open showing Play.
    });
  };

  const toggle = () => {
    if (audio.paused) {
      play();
    } else {
      audio.pause();
    }
  };

  const close = () => {
    audio.pause();
    audio.currentTime = 0;
    card.classList.remove('is-open');
  };

  const syncState = () => {
    const playing = !audio.paused;
    card.classList.toggle('is-playing', playing);
    label.textContent = playing ? 'Now playing' : 'Paused';
    toggleButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  };

  audio.addEventListener('play', syncState);
  audio.addEventListener('pause', syncState);

  audio.addEventListener('loadedmetadata', () => {
    durationLabel.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    const progress = audio.duration ? audio.currentTime / audio.duration : 0;
    bar.style.width = `${progress * 100}%`;
    timeLabel.textContent = formatTime(audio.currentTime);
  });

  toggleButton.addEventListener('click', toggle);
  closeButton.addEventListener('click', close);

  // Typing "juice" anywhere on the page starts the song; typing it again pauses or resumes.
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;

    typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);

    if (typed === SECRET) {
      typed = '';
      toggle();
    }
  });

  // Show the song's details in the system media controls (e.g. the Windows media pop-up).
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: card.querySelector('.now-playing-title').textContent,
      artist: card.querySelector('.now-playing-artist').textContent,
      album: 'Armed and Dangerous (Single, 2018)',
    });
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  }
})();
