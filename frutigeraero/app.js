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
  slideIntervalMs: 5000,
  endAfterImages: true,
  imageFadeOut: false,
  deletedImage: null,
  deletedSong: null,
  exportInProgress: false,
  cleanupUrls: [],
  renderedPreview: {
    blob: null,
    url: "",
    mimeType: "video/webm",
    fileName: "finding-past-export.webm"
  },
  renderDirty: true,
  timers: {
    imageTabInterval: null,
    imageUndoTimeout: null,
    songUndoTimeout: null
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

  elements.previewContainer = document.getElementById("previewContainer");
  elements.previewVideo = document.getElementById("previewVideo");
  elements.previewEmptyState = document.getElementById("previewEmptyState");
  elements.previewControlButton = document.getElementById("previewControl");
  elements.fullscreenButton = document.getElementById("fullscreenButton");
  elements.downloadButton = document.getElementById("downloadButton");
  elements.endConditionToggle = document.getElementById("endConditionToggle");

  elements.imagesPanel = document.getElementById("images");
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
  elements.previewControlButton.addEventListener("click", handlePreviewButtonClick);
  elements.downloadButton.addEventListener("click", handleDownloadButtonClick);

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
}

function initializeControls() {
  elements.intervalSlider.value = String(state.slideIntervalMs / 1000);
  elements.intervalValue.textContent = `${state.slideIntervalMs / 1000} seconds`;
  elements.endConditionToggle.textContent = state.endAfterImages ? "Images" : "Songs";
  elements.imageFadeToggle.textContent = state.imageFadeOut ? "Yes" : "No";
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  elements.tabButtons.forEach(button => button.classList.remove("active"));

  const targetPanel = document.getElementById(tabName);
  const targetButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);

  if (targetPanel) targetPanel.classList.add("active");
  if (targetButton) targetButton.classList.add("active");

  clearTimer("imageTabInterval");

  if (tabName === "images") {
    startImageTabSlideshow();
  }

  updateButtonStates();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    elements.previewContainer.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

async function handlePreviewButtonClick() {
  if (state.exportInProgress) return;

  if (state.imageList.length === 0 || state.songList.length === 0) {
    alert("Please add at least one image and one song before generating the preview.");
    return;
  }

  if (state.renderDirty || !state.renderedPreview.blob) {
    await renderPreviewVideo({ autoPlayAfterRender: true, downloadAfterRender: false });
    return;
  }

  await playRenderedPreview();
}

async function handleDownloadButtonClick() {
  if (state.exportInProgress) return;

  if (state.imageList.length === 0 || state.songList.length === 0) {
    alert("Please add at least one image and one song before downloading a video.");
    return;
  }

  if (state.renderDirty || !state.renderedPreview.blob) {
    await renderPreviewVideo({ autoPlayAfterRender: false, downloadAfterRender: true });
    return;
  }

  downloadBlob(state.renderedPreview.blob, state.renderedPreview.fileName);
}

async function playRenderedPreview() {
  if (!state.renderedPreview.url) return;

  elements.previewVideo.currentTime = 0;

  try {
    await safePlay(elements.previewVideo);
  } catch (error) {
    console.warn("Preview playback failed.", error);
  }
}

function startImageTabSlideshow() {
  clearTimer("imageTabInterval");

  if (!elements.imagesPanel.classList.contains("active")) return;
  if (state.imageList.length <= 1) return;

  state.timers.imageTabInterval = setInterval(() => {
    nextImage();
  }, state.slideIntervalMs);
}

function prevImage() {
  if (state.imageList.length === 0) return;

  state.currentImageIndex = (state.currentImageIndex - 1 + state.imageList.length) % state.imageList.length;
  updateImageDisplay();
}

function nextImage() {
  if (state.imageList.length === 0) return;

  state.currentImageIndex = (state.currentImageIndex + 1) % state.imageList.length;
  updateImageDisplay();
}

function updateInterval(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 1) return;

  state.slideIntervalMs = seconds * 1000;
  elements.intervalValue.textContent = `${seconds} seconds`;
  markRenderDirty();

  if (elements.imagesPanel.classList.contains("active")) {
    startImageTabSlideshow();
  }
}

function toggleEndCondition() {
  state.endAfterImages = !state.endAfterImages;
  elements.endConditionToggle.textContent = state.endAfterImages ? "Images" : "Songs";
  markRenderDirty();
}

function toggleImageFade() {
  state.imageFadeOut = !state.imageFadeOut;
  elements.imageFadeToggle.textContent = state.imageFadeOut ? "Yes" : "No";
  markRenderDirty();
}

function handleImageSelect(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

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
  markRenderDirty();
}

function handleSongSelect(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

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
  markRenderDirty();
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
  if (!state.imageList[index]) return;

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
  markRenderDirty();
}

function deleteSong(index) {
  if (!state.songList[index]) return;

  state.deletedSong = {
    item: state.songList[index],
    originalIndex: index
  };

  state.songList.splice(index, 1);

  renderSongList();
  updateAllDisplays();
  showUndoNotification(`You deleted "${state.deletedSong.item.title}".`, "song");
  markRenderDirty();
}

function undoDelete(type) {
  if (type === "image" && state.deletedImage) {
    state.imageList.splice(state.deletedImage.originalIndex, 0, state.deletedImage.item);
    state.deletedImage = null;
    hideUndoNotification("image", false);
    renderImageList();
    updateAllDisplays();
    startImageTabSlideshow();
    markRenderDirty();
    return;
  }

  if (type === "song" && state.deletedSong) {
    state.songList.splice(state.deletedSong.originalIndex, 0, state.deletedSong.item);
    state.deletedSong = null;
    hideUndoNotification("song", false);
    renderSongList();
    updateAllDisplays();
    markRenderDirty();
  }
}

function moveItem(type, index, direction) {
  const targetList = type === "image" ? state.imageList : state.songList;
  const currentIndexKey = type === "image" ? "currentImageIndex" : null;
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= targetList.length) return;

  const movedItem = targetList.splice(index, 1)[0];
  targetList.splice(newIndex, 0, movedItem);

  if (currentIndexKey) {
    if (state[currentIndexKey] === index) {
      state[currentIndexKey] = newIndex;
    } else if (index < state[currentIndexKey] && newIndex >= state[currentIndexKey]) {
      state[currentIndexKey] -= 1;
    } else if (index > state[currentIndexKey] && newIndex <= state[currentIndexKey]) {
      state[currentIndexKey] += 1;
    }
  }

  if (type === "image") {
    renderImageList();
    startImageTabSlideshow();
  } else {
    renderSongList();
  }

  updateAllDisplays();
  markRenderDirty();
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
  updatePreviewStage();
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

function updatePreviewStage() {
  const hasImages = state.imageList.length > 0;
  const hasSongs = state.songList.length > 0;

  if (!hasImages || !hasSongs) {
    elements.previewVideo.pause();
    elements.previewVideo.classList.add("hidden");
    elements.previewVideo.removeAttribute("src");
    elements.previewVideo.load();
    elements.previewEmptyState.textContent = getPreviewStatusMessage();
    elements.previewEmptyState.classList.remove("hidden");
    return;
  }

  if (state.exportInProgress) {
    elements.previewVideo.pause();
    elements.previewVideo.classList.add("hidden");
    elements.previewEmptyState.textContent = "Rendering preview video… this takes about as long as the video itself.";
    elements.previewEmptyState.classList.remove("hidden");
    return;
  }

  if (!state.renderDirty && state.renderedPreview.url) {
    if (elements.previewVideo.dataset.previewUrl !== state.renderedPreview.url) {
      elements.previewVideo.src = state.renderedPreview.url;
      elements.previewVideo.dataset.previewUrl = state.renderedPreview.url;
      elements.previewVideo.load();
    }

    elements.previewVideo.classList.remove("hidden");
    elements.previewEmptyState.classList.add("hidden");
    return;
  }

  elements.previewVideo.pause();
  elements.previewVideo.classList.add("hidden");
  elements.previewVideo.removeAttribute("src");
  delete elements.previewVideo.dataset.previewUrl;
  elements.previewVideo.load();
  elements.previewEmptyState.textContent = getPreviewStatusMessage();
  elements.previewEmptyState.classList.remove("hidden");
}

function updateButtonStates() {
  const hasImages = state.imageList.length > 0;
  const hasSongs = state.songList.length > 0;

  elements.prevImageButton.disabled = !hasImages || state.imageList.length < 2;
  elements.nextImageButton.disabled = !hasImages || state.imageList.length < 2;

  elements.previewControlButton.disabled = !hasImages || !hasSongs || state.exportInProgress;
  elements.downloadButton.disabled = !hasImages || !hasSongs || state.exportInProgress;

  if (state.exportInProgress) {
    elements.previewControlButton.textContent = "Rendering Preview…";
    elements.downloadButton.textContent = "Rendering Video…";
    return;
  }

  elements.previewControlButton.textContent =
    state.renderDirty || !state.renderedPreview.blob ? "Generate Preview" : "Play Preview";

  elements.downloadButton.textContent = "Download Video";
}

function getPreviewStatusMessage() {
  if (state.imageList.length === 0 && state.songList.length === 0) {
    return "Add images and music to generate a preview.";
  }

  if (state.imageList.length === 0) {
    return "Add at least one image to generate a preview.";
  }

  if (state.songList.length === 0) {
    return "Add at least one song to generate a preview.";
  }

  return "Preview not generated yet. Press Generate Preview.";
}

function markRenderDirty() {
  state.renderDirty = true;

  elements.previewVideo.pause();

  if (state.renderedPreview.url) {
    URL.revokeObjectURL(state.renderedPreview.url);
  }

  state.renderedPreview = {
    blob: null,
    url: "",
    mimeType: "video/webm",
    fileName: "finding-past-export.webm"
  };

  updatePreviewStage();
  updateButtonStates();
}

function clampIndex(index, length) {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

function clearTimer(key) {
  const timer = state.timers[key];
  if (!timer) return;

  clearInterval(timer);
  clearTimeout(timer);
  state.timers[key] = null;
}

function cleanupObjectUrls() {
  state.cleanupUrls.forEach(url => URL.revokeObjectURL(url));
  state.cleanupUrls = [];

  if (state.renderedPreview.url) {
    URL.revokeObjectURL(state.renderedPreview.url);
  }
}

function safePlay(mediaElement) {
  const playPromise = mediaElement.play();
  if (playPromise && typeof playPromise.then === "function") {
    return playPromise;
  }
  return Promise.resolve();
}

async function renderPreviewVideo({ autoPlayAfterRender, downloadAfterRender }) {
  if (state.exportInProgress) return;

  if (state.imageList.length === 0 || state.songList.length === 0) {
    alert("Please add at least one image and one song before rendering.");
    return;
  }

  if (!window.MediaRecorder) {
    alert("Your browser does not support in-browser video rendering here. Try current Chrome or Edge.");
    return;
  }

  const mimeType = getSupportedExportMimeType();
  if (!mimeType) {
    alert("Your browser does not support WebM export in MediaRecorder.");
    return;
  }

  state.exportInProgress = true;
  updatePreviewStage();
  updateButtonStates();

  let recorder = null;
  let stream = null;
  let audio = null;
  let forcedFinishTimeout = null;

  try {
    const durationMs = state.endAfterImages
      ? state.imageList.length * state.slideIntervalMs
      : await getPlaylistDurationMs(state.songList);

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Could not determine the video duration.");
    }

    const images = await Promise.all(state.imageList.map(loadImageForExport));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 1280;
    canvas.height = 720;

    stream = canvas.captureStream(30);

    audio = new Audio();
    audio.preload = "auto";
    audio.src = state.songList[0].url;
    audio.loop = state.endAfterImages;
    audio.muted = false;

    let audioTrackAdded = false;

    try {
      let audioStream = null;

      if (typeof audio.captureStream === "function") {
        audioStream = audio.captureStream();
      } else if (typeof audio.mozCaptureStream === "function") {
        audioStream = audio.mozCaptureStream();
      }

      if (audioStream) {
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
          audioTrackAdded = true;
        }
      }
    } catch (error) {
      console.warn("Audio capture failed; continuing without captured audio.", error);
    }

    const chunks = [];

    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5000000
    });

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const blobPromise = new Promise((resolve, reject) => {
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.onstop = finish;

      recorder.onerror = event => {
        if (finished) return;
        finished = true;
        reject(new Error(`MediaRecorder error: ${event?.error?.message || "Unknown recorder failure"}`));
      };

      forcedFinishTimeout = setTimeout(() => {
        if (finished) return;

        try {
          if (recorder && recorder.state !== "inactive") {
            recorder.requestData();
            recorder.stop();
          }
        } catch (error) {
          console.warn("Forced recorder stop failed.", error);
        }

        setTimeout(finish, 750);
      }, durationMs + 8000);
    });

    recorder.start(250);

    try {
      await safePlay(audio);
    } catch (error) {
      console.warn("Audio playback during render failed.", error);
    }

    const startTime = performance.now();

    await new Promise(resolve => {
      function drawFrame(now) {
        const elapsed = now - startTime;
        const clampedElapsed = Math.min(elapsed, durationMs);

        drawExportFrame(ctx, images, clampedElapsed, durationMs, canvas.width, canvas.height);

        if (elapsed < durationMs) {
          requestAnimationFrame(drawFrame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(drawFrame);
    });

    if (audioTrackAdded) {
      if (state.endAfterImages && audio) {
        audio.pause();
      }
    } else if (audio) {
      audio.pause();
    }

    if (recorder.state !== "inactive") {
      recorder.requestData();
      recorder.stop();
    }

    const blob = await blobPromise;
    const previewUrl = URL.createObjectURL(blob);

    if (state.renderedPreview.url) {
      URL.revokeObjectURL(state.renderedPreview.url);
    }

    state.renderedPreview = {
      blob,
      url: previewUrl,
      mimeType,
      fileName: "finding-past-export.webm"
    };

    state.renderDirty = false;
    updatePreviewStage();
    updateButtonStates();

    if (!audioTrackAdded) {
      alert("Preview rendered, but your browser did not expose the audio track for capture. The file may be silent.");
    }

    if (downloadAfterRender) {
      downloadBlob(blob, state.renderedPreview.fileName);
    }

    if (autoPlayAfterRender) {
      await playRenderedPreview();
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "There was an error rendering the preview video.");
  } finally {
    if (forcedFinishTimeout) {
      clearTimeout(forcedFinishTimeout);
    }

    if (audio) {
      audio.pause();
      audio.src = "";
    }

    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (_) {}
      });
    }

    state.exportInProgress = false;
    updatePreviewStage();
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

  if (!images.length) return;

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

  drawContainedImageNoUpscale(ctx, image, canvasWidth, canvasHeight, opacity);
}

function drawContainedImageNoUpscale(ctx, image, canvasWidth, canvasHeight, opacity) {
  const scale = Math.min(
    1,
    canvasWidth / image.width,
    canvasHeight / image.height
  );

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
    let resolved = false;

    const finalize = durationMs => {
      if (resolved) return;
      resolved = true;
      song.durationMs = durationMs;
      cleanup();
      resolve(durationMs);
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
      audio.src = "";
    };

    const onLoadedMetadata = () => {
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000
        : 30000;

      finalize(durationMs);
    };

    const onError = () => finalize(30000);

    const timeoutId = setTimeout(() => finalize(30000), 5000);

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("error", onError);
    audio.src = song.url;
  });
}