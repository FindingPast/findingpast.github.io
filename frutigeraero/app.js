const DEFAULT_IMAGES = [
  { url: "../assets/images/Frutiger Eco.jpeg", title: "Frutiger Eco", source: "default" },
  { url: "../assets/images/Gallery.jpeg", title: "Gallery", source: "default" },
  { url: "../assets/images/Life.jpeg", title: "Life", source: "default" },
  { url: "../assets/images/Open.jpeg", title: "Open", source: "default" },
  { url: "../assets/images/Vibes.jpeg", title: "Vibes", source: "default" }
];

const DEFAULT_SONGS = [
  { url: "../assets/music/Mii Editor - Nintendo.mp3", title: "Mii Editor - Nintendo", source: "default" },
  { url: "../assets/music/takeshi abo - LEASE.mp3", title: "takeshi abo - LEASE", source: "default" },
  { url: "../assets/music/yume 2kki - lotus waters.mp3", title: "yume 2kki - lotus waters", source: "default" }
];

const state = {
  imageList: DEFAULT_IMAGES.map(item => ({ ...item })),
  songList: DEFAULT_SONGS.map(item => ({ ...item })),
  currentImageIndex: 0,
  currentSongIndex: 0,
  slideIntervalMs: 5000,
  isPreviewPlaying: false,
  isPreviewFading: false,
  endAfterImages: true,
  imageFadeOut: false,
  deletedImage: null,
  deletedSong: null,
  exportInProgress: false,
  cleanupUrls: [],
  timers: {
    previewInterval: null,
    imageTabInterval: null,
    imageUndoTimeout: null,
    songUndoTimeout: null,
    audioFadeInterval: null,
    imageFadeTimeout: null
  }
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", cleanupObjectUrls);

function init() {
  cacheElements();
  bindEvents();
  initializeControls();
  renderImageList();
  renderSongList();
  updateAllDisplays();
  switchTab("preview");
}

function cacheElements() {
  elements.tabButtons = document.querySelectorAll(".tab-button");
  elements.tabPanels = document.querySelectorAll(".tab-panel");

  elements.previewPanel = document.getElementById("preview");
  elements.imagesPanel = document.getElementById("images");
  elements.musicPanel = document.getElementById("music");

  elements.previewContainer = document.getElementById("previewContainer");
  elements.previewSlide = document.getElementById("previewSlide");
  elements.previewEmptyState = document.getElementById("previewEmptyState");
  elements.previewAudio = document.getElementById("previewAudio");
  elements.previewControlButton = document.getElementById("previewControl");
  elements.fullscreenButton = document.getElementById("fullscreenButton");
  elements.downloadButton = document.getElementById("downloadButton");
  elements.endConditionToggle = document.getElementById("endConditionToggle");

  elements.imageSlide = document.getElementById("imageSlide");
  elements.imageEmptyState = document.getElementById("imageEmptyState");
  elements.prevImageButton = document.getElementById("prevImageButton");
  elements.nextImageButton = document.getElementById("nextImageButton");
  elements.intervalSlider = document.getElementById("intervalSlider");
  elements.intervalValue = document.getElementById("intervalValue");
  elements.imageFadeToggle = document.getElementById("imageFadeToggle");
  elements.imageItemsContainer = document.getElementById("imageItemsContainer");
  elements.imageImportButton = document.getElementById("imageImportButton");
  elements.imageFileInput = document.getElementById("imageFileInput");
  elements.imageUndoNotification = document.getElementById("imageUndoNotification");
  elements.imageUndoMessage = document.getElementById("imageUndoMessage");
  elements.imageUndoButton = document.getElementById("imageUndoButton");

  elements.songItemsContainer = document.getElementById("songItemsContainer");
  elements.songImportButton = document.getElementById("songImportButton");
  elements.songFileInput = document.getElementById("songFileInput");
  elements.songUndoNotification = document.getElementById("songUndoNotification");
  elements.songUndoMessage = document.getElementById("songUndoMessage");
  elements.songUndoButton = document.getElementById("songUndoButton");
}

function bindEvents() {
  elements.tabButtons.forEach(button => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  elements.fullscreenButton.addEventListener("click", toggleFullscreen);
  elements.previewControlButton.addEventListener("click", togglePreviewPlayback);
  elements.downloadButton.addEventListener("click", downloadAsVideo);

  elements.endConditionToggle.addEventListener("click", toggleEndCondition);
  elements.imageFadeToggle.addEventListener("click", toggleImageFade);

  elements.prevImageButton.addEventListener("click", prevImage);
  elements.nextImageButton.addEventListener("click", nextImage);
  elements.intervalSlider.addEventListener("input", event => updateInterval(event.target.value));

  elements.imageImportButton.addEventListener("click", () => elements.imageFileInput.click());
  elements.songImportButton.addEventListener("click", () => elements.songFileInput.click());

  elements.imageFileInput.addEventListener("change", handleImageSelect);
  elements.songFileInput.addEventListener("change", handleSongSelect);

  elements.imageUndoButton.addEventListener("click", () => undoDelete("image"));
  elements.songUndoButton.addEventListener("click", () => undoDelete("song"));

  elements.previewAudio.volume = 0.5;
}

function initializeControls() {
  elements.intervalSlider.value = String(state.slideIntervalMs / 1000);
  elements.intervalValue.textContent = `${state.slideIntervalMs / 1000} seconds`;
  elements.endConditionToggle.textContent = state.endAfterImages ? "Images" : "Songs";
  elements.imageFadeToggle.textContent = state.imageFadeOut ? "Yes" : "No";
  elements.previewControlButton.textContent = "Start Preview";
}

function switchTab(tabName) {
  elements.tabPanels.forEach(panel => panel.classList.remove("active"));
  elements.tabButtons.forEach(button => button.classList.remove("active"));

  const targetPanel = document.getElementById(tabName);
  const targetButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);

  if (targetPanel) {
    targetPanel.classList.add("active");
  }

  if (targetButton) {
    targetButton.classList.add("active");
  }

  clearTimer("imageTabInterval");

  if (state.isPreviewPlaying && tabName !== "preview") {
    stopPreview();
  }

  if (tabName === "images") {
    startImageTabSlideshow();
  }

  updateButtonStates();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    elements.previewContainer.requestFullscreen().catch(() => {});
    return;
  }

  document.exitFullscreen().catch(() => {});
}

function togglePreviewPlayback() {
  if (state.isPreviewPlaying) {
    stopPreview();
    return;
  }

  startPreview();
}

async function startPreview() {
  if (state.imageList.length === 0 || state.songList.length === 0) {
    alert("Please add at least one image and one song before starting the preview.");
    return;
  }

  clearPreviewTimers();

  state.isPreviewPlaying = true;
  state.isPreviewFading = false;
  state.currentImageIndex = 0;
  state.currentSongIndex = 0;

  elements.previewSlide.style.opacity = "1";
  elements.previewSlide.style.transition = "";
  elements.previewAudio.currentTime = 0;
  elements.previewAudio.volume = 0.5;
  elements.previewAudio.onended = handlePreviewSongEnded;
  elements.previewAudio.src = state.songList[state.currentSongIndex].url;

  updateAllDisplays();

  try {
    await safePlay(elements.previewAudio);
  } catch (error) {
    console.warn("Preview audio playback was blocked or failed.", error);
  }

  schedulePreviewInterval();
  updateButtonStates();
}

function stopPreview() {
  clearPreviewTimers();

  state.isPreviewPlaying = false;
  state.isPreviewFading = false;
  state.currentImageIndex = 0;
  state.currentSongIndex = 0;

  elements.previewAudio.pause();
  elements.previewAudio.currentTime = 0;
  elements.previewAudio.volume = 0.5;
  elements.previewAudio.onended = null;

  elements.previewSlide.style.opacity = "1";
  elements.previewSlide.style.transition = "";

  updateAllDisplays();
  updateButtonStates();

  if (elements.imagesPanel.classList.contains("active")) {
    startImageTabSlideshow();
  }
}

function schedulePreviewInterval() {
  clearTimer("previewInterval");

  if (state.imageList.length === 0) {
    return;
  }

  state.timers.previewInterval = setInterval(() => {
    if (!state.isPreviewPlaying || state.isPreviewFading) {
      return;
    }

    if (state.endAfterImages && state.currentImageIndex >= state.imageList.length - 1) {
      fadeOutAndStopPreview();
      return;
    }

    state.currentImageIndex = (state.currentImageIndex + 1) % state.imageList.length;
    updatePreviewDisplay();
    updateImageDisplay();
  }, state.slideIntervalMs);
}

async function handlePreviewSongEnded() {
  if (!state.isPreviewPlaying || state.isPreviewFading) {
    return;
  }

  const lastSongIndex = state.songList.length - 1;

  if (!state.endAfterImages && state.currentSongIndex >= lastSongIndex) {
    fadeOutAndStopPreview();
    return;
  }

  state.currentSongIndex = (state.currentSongIndex + 1) % state.songList.length;
  elements.previewAudio.src = state.songList[state.currentSongIndex].url;

  try {
    await safePlay(elements.previewAudio);
  } catch (error) {
    console.warn("Preview next-song playback failed.", error);
  }
}

function fadeOutAndStopPreview() {
  if (!state.isPreviewPlaying || state.isPreviewFading) {
    return;
  }

  state.isPreviewFading = true;
  clearTimer("previewInterval");

  const fadeDurationMs = 3000;
  const fadeSteps = 24;
  const stepInterval = fadeDurationMs / fadeSteps;
  const startingVolume = elements.previewAudio.volume;
  let step = 0;

  if (state.imageFadeOut) {
    elements.previewSlide.style.transition = `opacity ${fadeDurationMs}ms ease-out`;
    clearTimer("imageFadeTimeout");
    state.timers.imageFadeTimeout = setTimeout(() => {
      elements.previewSlide.style.opacity = "0";
    }, 40);
  }

  clearTimer("audioFadeInterval");
  state.timers.audioFadeInterval = setInterval(() => {
    step += 1;
    const nextVolume = Math.max(0, startingVolume * (1 - step / fadeSteps));
    elements.previewAudio.volume = nextVolume;

    if (step >= fadeSteps) {
      stopPreview();
    }
  }, stepInterval);
}

function startImageTabSlideshow() {
  clearTimer("imageTabInterval");

  if (!elements.imagesPanel.classList.contains("active")) {
    return;
  }

  if (state.imageList.length <= 1) {
    return;
  }

  state.timers.imageTabInterval = setInterval(() => {
    nextImage();
  }, state.slideIntervalMs);
}

function prevImage() {
  if (state.imageList.length === 0) {
    return;
  }

  state.currentImageIndex = (state.currentImageIndex - 1 + state.imageList.length) % state.imageList.length;
  updateImageDisplay();

  if (!state.isPreviewPlaying) {
    updatePreviewDisplay();
  }
}

function nextImage() {
  if (state.imageList.length === 0) {
    return;
  }

  state.currentImageIndex = (state.currentImageIndex + 1) % state.imageList.length;
  updateImageDisplay();

  if (!state.isPreviewPlaying) {
    updatePreviewDisplay();
  }
}

function updateInterval(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 1) {
    return;
  }

  state.slideIntervalMs = seconds * 1000;
  elements.intervalValue.textContent = `${seconds} seconds`;

  if (state.isPreviewPlaying) {
    schedulePreviewInterval();
  }

  if (elements.imagesPanel.classList.contains("active")) {
    startImageTabSlideshow();
  }
}

function toggleEndCondition() {
  state.endAfterImages = !state.endAfterImages;
  elements.endConditionToggle.textContent = state.endAfterImages ? "Images" : "Songs";
}

function toggleImageFade() {
  state.imageFadeOut = !state.imageFadeOut;
  elements.imageFadeToggle.textContent = state.imageFadeOut ? "Yes" : "No";
}

function handleImageSelect(event) {
  const files = Array.from(event.target.files || []);

  if (files.length === 0) {
    return;
  }

  if (state.isPreviewPlaying) {
    stopPreview();
  }

  files.forEach(file => {
    const url = URL.createObjectURL(file);
    state.cleanupUrls.push(url);

    state.imageList.push({
      url,
      title: file.name,
      source: "imported"
    });
  });

  event.target.value = "";
  renderImageList();
  updateAllDisplays();
  startImageTabSlideshow();
}

function handleSongSelect(event) {
  const files = Array.from(event.target.files || []);

  if (files.length === 0) {
    return;
  }

  if (state.isPreviewPlaying) {
    stopPreview();
  }

  files.forEach(file => {
    const url = URL.createObjectURL(file);
    state.cleanupUrls.push(url);

    state.songList.push({
      url,
      title: file.name,
      source: "imported"
    });
  });

  event.target.value = "";
  renderSongList();
  updateAllDisplays();
}

function renderImageList() {
  const container = elements.imageItemsContainer;
  container.innerHTML = "";

  if (state.imageList.length === 0) {
    container.appendChild(createEmptyListMessage("No images yet. Import some to start building your video."));
    return;
  }

  const fragment = document.createDocumentFragment();

  state.imageList.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "media-item";

    const controls = document.createElement("div");
    controls.className = "item-controls";

    const upButton = createMoveButton("↑", index === 0, () => moveItem("image", index, -1));
    const downButton = createMoveButton("↓", index === state.imageList.length - 1, () => moveItem("image", index, 1));

    controls.append(upButton, downButton);

    const thumb = document.createElement("img");
    thumb.className = "media-thumb";
    thumb.src = image.url;
    thumb.alt = image.title;

    const title = document.createElement("span");
    title.className = "media-title";
    title.textContent = image.title;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete image ${image.title}`);
    deleteButton.addEventListener("click", () => deleteImage(index));

    item.append(controls, thumb, title, deleteButton);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

function renderSongList() {
  const container = elements.songItemsContainer;
  container.innerHTML = "";

  if (state.songList.length === 0) {
    container.appendChild(createEmptyListMessage("No songs yet. Import at least one to power the slideshow."));
    return;
  }

  const fragment = document.createDocumentFragment();

  state.songList.forEach((song, index) => {
    const item = document.createElement("div");
    item.className = "media-item";

    const controls = document.createElement("div");
    controls.className = "item-controls";

    const upButton = createMoveButton("↑", index === 0, () => moveItem("song", index, -1));
    const downButton = createMoveButton("↓", index === state.songList.length - 1, () => moveItem("song", index, 1));

    controls.append(upButton, downButton);

    const title = document.createElement("span");
    title.className = "media-title";
    title.textContent = song.title;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete song ${song.title}`);
    deleteButton.addEventListener("click", () => deleteSong(index));

    item.append(controls, title, deleteButton);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

function createEmptyListMessage(message) {
  const empty = document.createElement("div");
  empty.className = "media-list-empty";
  empty.textContent = message;
  return empty;
}

function createMoveButton(label, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function deleteImage(index) {
  if (!state.imageList[index]) {
    return;
  }

  if (state.isPreviewPlaying) {
    stopPreview();
  }

  state.deletedImage = {
    item: state.imageList[index],
    originalIndex: index
  };

  state.imageList.splice(index, 1);

  if (index < state.currentImageIndex) {
    state.currentImageIndex -= 1;
  }

  if (state.currentImageIndex >= state.imageList.length) {
    state.currentImageIndex = Math.max(0, state.imageList.length - 1);
  }

  renderImageList();
  updateAllDisplays();
  startImageTabSlideshow();
  showUndoNotification(`You deleted "${state.deletedImage.item.title}".`, "image");
}

function deleteSong(index) {
  if (!state.songList[index]) {
    return;
  }

  if (state.isPreviewPlaying) {
    stopPreview();
  }

  state.deletedSong = {
    item: state.songList[index],
    originalIndex: index
  };

  state.songList.splice(index, 1);

  if (index < state.currentSongIndex) {
    state.currentSongIndex -= 1;
  }

  if (state.currentSongIndex >= state.songList.length) {
    state.currentSongIndex = Math.max(0, state.songList.length - 1);
  }

  renderSongList();
  updateAllDisplays();
  showUndoNotification(`You deleted "${state.deletedSong.item.title}".`, "song");
}

function undoDelete(type) {
  if (type === "image" && state.deletedImage) {
    state.imageList.splice(state.deletedImage.originalIndex, 0, state.deletedImage.item);
    state.deletedImage = null;
    hideUndoNotification("image", false);
    renderImageList();
    updateAllDisplays();
    startImageTabSlideshow();
    return;
  }

  if (type === "song" && state.deletedSong) {
    state.songList.splice(state.deletedSong.originalIndex, 0, state.deletedSong.item);
    state.deletedSong = null;
    hideUndoNotification("song", false);
    renderSongList();
    updateAllDisplays();
  }
}

function moveItem(type, index, direction) {
  if (state.isPreviewPlaying) {
    stopPreview();
  }

  const targetList = type === "image" ? state.imageList : state.songList;
  const currentIndexKey = type === "image" ? "currentImageIndex" : "currentSongIndex";
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= targetList.length) {
    return;
  }

  const movedItem = targetList.splice(index, 1)[0];
  targetList.splice(newIndex, 0, movedItem);

  if (state[currentIndexKey] === index) {
    state[currentIndexKey] = newIndex;
  } else if (index < state[currentIndexKey] && newIndex >= state[currentIndexKey]) {
    state[currentIndexKey] -= 1;
  } else if (index > state[currentIndexKey] && newIndex <= state[currentIndexKey]) {
    state[currentIndexKey] += 1;
  }

  if (type === "image") {
    renderImageList();
  } else {
    renderSongList();
  }

  updateAllDisplays();
  startImageTabSlideshow();
}

function showUndoNotification(message, type) {
  const timeoutKey = type === "image" ? "imageUndoTimeout" : "songUndoTimeout";
  const notification = type === "image" ? elements.imageUndoNotification : elements.songUndoNotification;
  const messageNode = type === "image" ? elements.imageUndoMessage : elements.songUndoMessage;

  clearTimer(timeoutKey);
  messageNode.textContent = message;
  notification.classList.add("show");

  state.timers[timeoutKey] = setTimeout(() => {
    hideUndoNotification(type, true);
  }, 5000);
}

function hideUndoNotification(type, clearDeleted) {
  const timeoutKey = type === "image" ? "imageUndoTimeout" : "songUndoTimeout";
  const notification = type === "image" ? elements.imageUndoNotification : elements.songUndoNotification;

  clearTimer(timeoutKey);
  notification.classList.remove("show");

  if (clearDeleted) {
    if (type === "image") {
      state.deletedImage = null;
    } else {
      state.deletedSong = null;
    }
  }
}

function updateAllDisplays() {
  updateImageDisplay();
  updatePreviewDisplay();
  updatePreviewAudioSource();
  updateButtonStates();
}

function updateImageDisplay() {
  if (state.imageList.length === 0) {
    elements.imageSlide.classList.add("hidden");
    elements.imageSlide.removeAttribute("src");
    elements.imageEmptyState.classList.remove("hidden");
    return;
  }

  state.currentImageIndex = clampIndex(state.currentImageIndex, state.imageList.length);
  const currentImage = state.imageList[state.currentImageIndex];

  elements.imageSlide.src = currentImage.url;
  elements.imageSlide.alt = currentImage.title;
  elements.imageSlide.classList.remove("hidden");
  elements.imageEmptyState.classList.add("hidden");
}

function updatePreviewDisplay() {
  const hasImages = state.imageList.length > 0;
  const hasSongs = state.songList.length > 0;

  if (state.isPreviewPlaying && hasImages && hasSongs) {
    state.currentImageIndex = clampIndex(state.currentImageIndex, state.imageList.length);
    const currentImage = state.imageList[state.currentImageIndex];

    elements.previewSlide.src = currentImage.url;
    elements.previewSlide.alt = currentImage.title;
    elements.previewSlide.classList.remove("hidden");
    elements.previewEmptyState.classList.add("hidden");
    return;
  }

  elements.previewSlide.classList.add("hidden");
  elements.previewSlide.removeAttribute("src");
  elements.previewEmptyState.textContent = getPreviewStatusMessage();
  elements.previewEmptyState.classList.remove("hidden");
}

function updatePreviewAudioSource() {
  if (state.isPreviewPlaying || state.songList.length === 0) {
    return;
  }

  state.currentSongIndex = clampIndex(state.currentSongIndex, state.songList.length);
  elements.previewAudio.src = state.songList[state.currentSongIndex]?.url || "";
}

function updateButtonStates() {
  const hasImages = state.imageList.length > 0;
  const hasSongs = state.songList.length > 0;

  elements.previewControlButton.textContent = state.isPreviewPlaying ? "Stop Preview" : "Start Preview";
  elements.prevImageButton.disabled = !hasImages || state.imageList.length < 2;
  elements.nextImageButton.disabled = !hasImages || state.imageList.length < 2;
  elements.downloadButton.disabled = !hasImages || !hasSongs || state.exportInProgress;

  if (state.exportInProgress) {
    elements.downloadButton.textContent = "Recording Export…";
  } else {
    elements.downloadButton.textContent = "Download Video";
  }
}

function getPreviewStatusMessage() {
  if (state.imageList.length === 0 && state.songList.length === 0) {
    return "Add images and music to start the preview.";
  }

  if (state.imageList.length === 0) {
    return "Add at least one image to start the preview.";
  }

  if (state.songList.length === 0) {
    return "Add at least one song to start the preview.";
  }

  return "Preview is ready. Press Start Preview.";
}

function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= length) {
    return length - 1;
  }

  return index;
}

function clearPreviewTimers() {
  clearTimer("previewInterval");
  clearTimer("audioFadeInterval");
  clearTimer("imageFadeTimeout");
}

function clearTimer(key) {
  const timer = state.timers[key];

  if (!timer) {
    return;
  }

  clearInterval(timer);
  clearTimeout(timer);
  state.timers[key] = null;
}

function cleanupObjectUrls() {
  state.cleanupUrls.forEach(url => URL.revokeObjectURL(url));
  state.cleanupUrls = [];
}

function safePlay(mediaElement) {
  const playPromise = mediaElement.play();

  if (playPromise && typeof playPromise.then === "function") {
    return playPromise;
  }

  return Promise.resolve();
}

async function downloadAsVideo() {
  if (state.exportInProgress) {
    return;
  }

  if (state.imageList.length === 0 || state.songList.length === 0) {
    alert("Please add at least one image and one song before exporting a video.");
    return;
  }

  if (!window.MediaRecorder) {
    alert("Your browser does not support video export here. Try a current version of Chrome or Edge.");
    return;
  }

  const mimeType = getSupportedExportMimeType();

  if (!mimeType) {
    alert("Your browser does not support WebM export in MediaRecorder.");
    return;
  }

  state.exportInProgress = true;
  updateButtonStates();

  let audioContext;
  let recorder;
  let exportAudio;
  let destinationNode;
  let sourceNode;
  let gainNode;

  try {
    const durationMs = state.endAfterImages
      ? state.imageList.length * state.slideIntervalMs
      : await getPlaylistDurationMs(state.songList);

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Could not determine the export duration.");
    }

    const loadedImages = await Promise.all(state.imageList.map(loadImageForExport));

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;

    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(30);

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    exportAudio = new Audio();
    exportAudio.preload = "auto";

    sourceNode = audioContext.createMediaElementSource(exportAudio);
    gainNode = audioContext.createGain();
    destinationNode = audioContext.createMediaStreamDestination();

    sourceNode.connect(gainNode);
    gainNode.connect(destinationNode);
    gainNode.connect(audioContext.destination);

    destinationNode.stream.getAudioTracks().forEach(track => {
      stream.addTrack(track);
    });

    let exportSongIndex = 0;

    exportAudio.onended = async () => {
      if (!state.exportInProgress) {
        return;
      }

      if (state.endAfterImages) {
        exportSongIndex = (exportSongIndex + 1) % state.songList.length;
      } else {
        exportSongIndex += 1;

        if (exportSongIndex >= state.songList.length) {
          return;
        }
      }

      exportAudio.src = state.songList[exportSongIndex].url;

      try {
        await safePlay(exportAudio);
      } catch (error) {
        console.warn("Export audio playback failed.", error);
      }
    };

    exportAudio.src = state.songList[0].url;

    const chunks = [];

    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000
    });

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const blobPromise = new Promise(resolve => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    recorder.start(250);

    try {
      await safePlay(exportAudio);
    } catch (error) {
      console.warn("Export started without audible playback.", error);
    }

    const startTime = performance.now();

    await new Promise(resolve => {
      function drawFrame(now) {
        const elapsed = now - startTime;
        const remaining = Math.max(0, durationMs - elapsed);

        drawExportFrame(ctx, loadedImages, elapsed, durationMs, canvas.width, canvas.height);

        if (remaining <= 3000) {
          gainNode.gain.value = Math.max(0, remaining / 3000);
        } else {
          gainNode.gain.value = 1;
        }

        if (elapsed < durationMs) {
          requestAnimationFrame(drawFrame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(drawFrame);
    });

    recorder.stop();
    exportAudio.pause();

    const blob = await blobPromise;
    downloadBlob(blob, "finding-past-export.webm");
  } catch (error) {
    console.error(error);
    alert(error.message || "There was an error creating the export.");
  } finally {
    if (exportAudio) {
      exportAudio.pause();
      exportAudio.src = "";
      exportAudio.onended = null;
    }

    if (sourceNode) {
      sourceNode.disconnect();
    }

    if (gainNode) {
      gainNode.disconnect();
    }

    if (destinationNode) {
      destinationNode.disconnect();
    }

    if (audioContext && audioContext.state !== "closed") {
      try {
        await audioContext.close();
      } catch (error) {
        console.warn("Audio context cleanup failed.", error);
      }
    }

    state.exportInProgress = false;
    updateButtonStates();
  }
}

function getSupportedExportMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function loadImageForExport(imageItem) {
  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = imageItem.url;
  });
}

function drawExportFrame(ctx, images, elapsed, totalDurationMs, canvasWidth, canvasHeight) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (!images.length) {
    return;
  }

  const imageIndex = state.endAfterImages
    ? Math.min(Math.floor(elapsed / state.slideIntervalMs), images.length - 1)
    : Math.floor(elapsed / state.slideIntervalMs) % images.length;

  const image = images[imageIndex];

  if (!image) {
    ctx.fillStyle = "#888888";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Image could not be loaded", canvasWidth / 2, canvasHeight / 2);
    return;
  }

  const remaining = Math.max(0, totalDurationMs - elapsed);
  let opacity = 1;

  if (state.imageFadeOut && remaining <= 3000) {
    opacity = remaining / 3000;
  }

  drawContainedImage(ctx, image, canvasWidth, canvasHeight, opacity);
}

function drawContainedImage(ctx, image, canvasWidth, canvasHeight, opacity) {
  const scale = Math.min(canvasWidth / image.width, canvasHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (canvasWidth - drawWidth) / 2;
  const y = (canvasHeight - drawHeight) / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

async function getPlaylistDurationMs(songList) {
  const durations = await Promise.all(songList.map(getSongDurationMs));
  return durations.reduce((sum, value) => sum + value, 0);
}

function getSongDurationMs(song) {
  if (Number.isFinite(song.durationMs) && song.durationMs > 0) {
    return Promise.resolve(song.durationMs);
  }

  return new Promise(resolve => {
    const audio = document.createElement("audio");

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
      audio.src = "";
    };

    const onLoadedMetadata = () => {
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000
        : 30000;

      song.durationMs = durationMs;
      cleanup();
      resolve(durationMs);
    };

    const onError = () => {
      song.durationMs = 30000;
      cleanup();
      resolve(30000);
    };

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("error", onError);
    audio.src = song.url;
  });
}