/** Bind explicit audio controls. Nothing starts playing until Play is pressed. */
export function setupAudio({ audio, select, playButton, pauseButton, status }) {
  audio.volume = 0.28;
  audio.loop = true;
  audio.preload = 'none';
  let activeSource = '';

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const onPlay = async () => {
    const selectedSource = select.value;
    if (!selectedSource) return;

    if (activeSource !== selectedSource) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.src = selectedSource;
      activeSource = selectedSource;
    }

    try {
      await audio.play();
      setStatus('Now playing.');
    } catch (error) {
      console.warn('Audio playback could not start:', error);
      setStatus('Playback was blocked or the audio file could not be loaded. Press Play to try again.');
    }
  };

  const onPause = () => {
    audio.pause();
    setStatus('Audio paused.');
  };

  const onSelectionChange = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    activeSource = '';
    setStatus('Track changed. Press Play when you are ready.');
  };

  playButton.addEventListener('click', onPlay);
  pauseButton.addEventListener('click', onPause);
  select.addEventListener('change', onSelectionChange);

  return () => {
    playButton.removeEventListener('click', onPlay);
    pauseButton.removeEventListener('click', onPause);
    select.removeEventListener('change', onSelectionChange);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
