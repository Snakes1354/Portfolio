(() => {
  const card = document.querySelector('.now-playing');
  const audio = card && card.querySelector('.now-playing-audio');
  if (!audio) return;

  // Typing a song's secret anywhere on the page plays it. Only one song plays at a time.
  const TRACKS = [
    {
      secret: 'juice',
      src: 'audio/armed-and-dangerous.mp3',
      cover: 'images/armed-and-dangerous.jpg',
      title: 'Armed and Dangerous',
      artist: 'Juice WRLD',
      album: 'Armed and Dangerous (Single, 2018)',
      length: '2:50',
      credits: [
        'Single · 2018 · Grade A / Interscope Records',
        'Produced by Dre Moon · Written by Jarad Higgins & Andre Proctor',
      ],
      owners: 'Juice WRLD, Grade A and Interscope Records',
      spotify: 'https://open.spotify.com/album/0QlPckQjNQUY8WOXbi3Wc4',
      youtube: 'https://www.youtube.com/watch?v=cr82wSBZeeQ',
    },
    {
      secret: 'don',
      src: 'audio/e85.mp3',
      cover: 'images/octane.jpg',
      title: 'E85',
      artist: 'Don Toliver',
      album: 'OCTANE (2026)',
      length: '2:33',
      credits: [
        'OCTANE · 2026 · Donnway & Co / Cactus Jack / Atlantic Records',
        'Produced by Travis Scott, Aaron Paris, 206Derek & Jaasu',
        'Written by Caleb Toliver, Jacques Webster II, Aaron Cheung, Derek Anderson, '
          + 'Jaasu Mallory, Malcolm Hobert, Charles Ziman & Jonah Cochran',
        'Contains a sample of “Chest Pain (I Love)” by Malcolm Todd',
      ],
      owners: 'Don Toliver, Donnway & Co, Cactus Jack and Atlantic Records',
      spotify: 'https://open.spotify.com/album/131x9G87mD0hP0hGZc9qYN',
      youtube: 'https://www.youtube.com/watch?v=rVD-zV6ctoM',
    },
  ];

  const toggleButton = card.querySelector('.now-playing-toggle');
  const closeButton = card.querySelector('.now-playing-close');
  const cover = card.querySelector('.now-playing-cover');
  const label = card.querySelector('.now-playing-label');
  const titleLabel = card.querySelector('.now-playing-title');
  const artistLabel = card.querySelector('.now-playing-artist');
  const credits = card.querySelector('.now-playing-credits');
  const rights = card.querySelector('.now-playing-rights');
  const bar = card.querySelector('.now-playing-bar span');
  const timeLabel = card.querySelector('.now-playing-time');
  const durationLabel = card.querySelector('.now-playing-duration');
  const longestSecret = Math.max(...TRACKS.map((track) => track.secret.length));
  let current = null;
  let typed = '';

  audio.volume = 0.6;

  const formatTime = (seconds) => {
    const whole = Math.floor(seconds || 0);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };

  const link = (text, href) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = text;
    return anchor;
  };

  // Album art replaces the music-note icon once it loads; if it is missing, the icon stays.
  cover.addEventListener('load', () => card.classList.add('has-cover'));
  cover.addEventListener('error', () => card.classList.remove('has-cover'));

  const load = (track) => {
    current = track;
    audio.src = track.src;

    card.classList.remove('has-cover');
    cover.src = track.cover;
    titleLabel.textContent = track.title;
    artistLabel.textContent = track.artist;
    credits.replaceChildren(...track.credits.flatMap((line, index) => (
      index ? [document.createElement('br'), line] : [line]
    )));
    rights.replaceChildren(
      `All rights belong to ${track.owners}. Listen on `,
      link('Spotify', track.spotify),
      ' or ',
      link('YouTube', track.youtube),
      '.',
    );

    bar.style.width = '0%';
    timeLabel.textContent = '0:00';
    durationLabel.textContent = track.length;

    // Show the song's details in the system media controls (e.g. the Windows media pop-up).
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [{ src: new URL(track.cover, document.baseURI).href }],
      });
    }
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

  // Typing the playing song's secret again pauses or resumes it; another song's secret switches to it.
  const choose = (track) => {
    if (track !== current) {
      audio.pause();
      load(track);
      play();
      return;
    }

    toggle();
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

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;

    typed = (typed + event.key.toLowerCase()).slice(-longestSecret);
    const match = TRACKS.find((track) => typed.endsWith(track.secret));

    if (match) {
      typed = '';
      choose(match);
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  }

  load(TRACKS[0]);
})();
