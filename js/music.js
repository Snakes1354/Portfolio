(() => {
  const card = document.querySelector('.now-playing');
  const audio = card && card.querySelector('.now-playing-audio');
  if (!audio) return;

  // Typing a playlist's secret anywhere on the page plays it. Only one song plays at a time.
  const PLAYLISTS = [
    {
      secret: 'juice',
      tracks: [
        {
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
      ],
    },
    {
      secret: 'don',
      tracks: [
        {
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
        {
          src: 'audio/no-pole.mp3',
          cover: 'images/love-sick.jpg',
          title: 'No Pole',
          artist: 'Don Toliver',
          album: 'Love Sick (Deluxe) (2023)',
          length: '3:07',
          credits: [
            'Love Sick (Deluxe) · 2023 · Cactus Jack / Atlantic Records',
            'Produced by Cardo & DJ Fresh',
            'Written by Caleb Toliver, Ronald LaTour Jr., Marqus Brown & Douglas Ford',
          ],
          owners: 'Don Toliver, Cactus Jack and Atlantic Records',
          spotify: 'https://open.spotify.com/album/2Q2TRdT994vTzGE3Grmmht',
          youtube: 'https://www.youtube.com/watch?v=A5mURRozXtg',
        },
        {
          src: 'audio/secondhand.mp3',
          cover: 'images/octane.jpg',
          title: 'Secondhand',
          artist: 'Don Toliver ft. Rema',
          album: 'OCTANE (2026)',
          length: '3:46',
          credits: [
            'OCTANE · 2026 · Donnway & Co / Cactus Jack / Atlantic Records',
            'Produced by 206Derek, Roark Bailey & Gabe Shaddow',
            'Written by Caleb Toliver, Divine Ikubor, Derek Anderson, Roark Bailey & Gabe Shaddow',
          ],
          owners: 'Don Toliver, Rema, Donnway & Co, Cactus Jack and Atlantic Records',
          spotify: 'https://open.spotify.com/album/131x9G87mD0hP0hGZc9qYN',
          youtube: 'https://www.youtube.com/results?search_query=Don+Toliver+Rema+Secondhand',
        },
        {
          src: 'audio/cardigan.mp3',
          cover: 'images/heaven-or-hell.jpg',
          title: 'Cardigan',
          artist: 'Don Toliver',
          album: 'Heaven or Hell (2020)',
          length: '2:38',
          credits: [
            'Heaven or Hell · 2020 · Cactus Jack / We Run It / Atlantic Records',
            'Produced by Sonny Digital, Frank Dukes, CVRE & MIDO',
            'Written by Caleb Toliver, Sonny Uwaezuoke, Adam Feeney & Mike Dean',
          ],
          owners: 'Don Toliver, Cactus Jack, We Run It Entertainment and Atlantic Records',
          spotify: 'https://open.spotify.com/album/7z4GhRfLqfSkqrj5F3Yt2B',
          youtube: 'https://www.youtube.com/results?search_query=Don+Toliver+Cardigan+Official+Music+Video',
        },
        {
          src: 'audio/no-idea.mp3',
          cover: 'images/heaven-or-hell.jpg',
          title: 'No Idea',
          artist: 'Don Toliver',
          album: 'Heaven or Hell (2020)',
          length: '2:45',
          credits: [
            'Heaven or Hell · 2020 · Cactus Jack / We Run It / Atlantic Records',
            'Produced by WondaGurl & Cubeatz',
            'Written by Caleb Toliver, Ebony Oshunrinde, Tim Gomringer & Kevin Gomringer',
          ],
          owners: 'Don Toliver, Cactus Jack, We Run It Entertainment and Atlantic Records',
          spotify: 'https://open.spotify.com/album/7z4GhRfLqfSkqrj5F3Yt2B',
          youtube: 'https://www.youtube.com/results?search_query=Don+Toliver+No+Idea+Official+Video',
        },
      ],
    },
  ];

  const toggleButton = card.querySelector('.now-playing-toggle');
  const skipButton = card.querySelector('.now-playing-skip');
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
  const longestSecret = Math.max(...PLAYLISTS.map((playlist) => playlist.secret.length));
  let playlist = null;
  let index = 0;
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

  const load = (nextPlaylist, nextIndex) => {
    const track = nextPlaylist.tracks[nextIndex];
    playlist = nextPlaylist;
    index = nextIndex;
    audio.src = track.src;

    // Only playlists with more than one song get a skip button.
    const hasQueue = playlist.tracks.length > 1;
    card.classList.toggle('has-queue', hasQueue);

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
      navigator.mediaSession.setActionHandler('nexttrack', hasQueue ? () => skip() : null);
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

  // Move on to the playlist's next song, back to the first after the last.
  const skip = () => {
    audio.pause();
    load(playlist, (index + 1) % playlist.tracks.length);
    play();
  };

  // Typing the playing playlist's secret again pauses or resumes it; another secret switches to it.
  const choose = (nextPlaylist) => {
    if (nextPlaylist !== playlist) {
      audio.pause();
      load(nextPlaylist, 0);
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

  // A playlist carries on to its next song by itself.
  audio.addEventListener('ended', () => {
    if (playlist.tracks.length > 1) skip();
  });

  toggleButton.addEventListener('click', toggle);
  skipButton.addEventListener('click', skip);
  closeButton.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;

    typed = (typed + event.key.toLowerCase()).slice(-longestSecret);
    const match = PLAYLISTS.find((candidate) => typed.endsWith(candidate.secret));

    if (match) {
      typed = '';
      choose(match);
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  }

  load(PLAYLISTS[0], 0);
})();
