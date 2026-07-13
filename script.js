const views = ['dashboard', 'writing', 'grammar', 'reading', 'stats'];
const viewElements = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('[data-view]');
const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function navigate(viewName) {
  if (!views.includes(viewName)) return;
  viewElements.forEach((view) => view.classList.toggle('active-view', view.dataset.page === viewName));
  navItems.forEach((item) => {
    const active = item.dataset.view === viewName;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach((item) => item.addEventListener('click', () => navigate(item.dataset.view)));
document.querySelectorAll('[data-go-to]').forEach((item) => {
  item.addEventListener('click', () => navigate(item.dataset.goTo));
});

const readingLibrary = Array.isArray(window.readingLibrary) ? window.readingLibrary : [];
const grammarQuestions = Array.isArray(window.grammarQuestions) ? window.grammarQuestions : [];
const writingQuestions = Array.isArray(window.writingPrompts) ? window.writingPrompts : [];
const writingExercises = writingQuestions.map((writing) => ({
  id: `writing-${writing.id}`,
  section: 'Writing',
  title: writing.title
}));
const grammarExercises = grammarQuestions.map((question) => ({
  id: `grammar-${question.id}`,
  section: 'Grammar',
  title: question.prompt
}));
const exerciseCatalog = [
  ...writingExercises,
  ...grammarExercises,
  ...readingLibrary.map((reading) => ({
    id: `reading-${reading.id}`,
    section: 'Reading',
    title: reading.title
  }))
];
const statsStorageKey = 'engli.exercise-results.v1';
let exerciseResults = loadExerciseResults();

function loadExerciseResults() {
  try {
    const stored = window.localStorage.getItem(statsStorageKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveExerciseResults() {
  try {
    window.localStorage.setItem(statsStorageKey, JSON.stringify(exerciseResults));
  } catch (error) {
    // The exercise still works when storage is unavailable.
  }
}

function clampScore(score) {
  return Math.max(0, Math.min(1, Number(score) || 0));
}

function getStats() {
  const sections = [...new Set(exerciseCatalog.map((exercise) => exercise.section))];
  const completed = exerciseCatalog.filter((exercise) => exerciseResults[exercise.id]?.completed);
  const scoreSum = exerciseCatalog.reduce((sum, exercise) => sum + clampScore(exerciseResults[exercise.id]?.score), 0);
  const bySection = sections.map((section) => {
    const exercises = exerciseCatalog.filter((exercise) => exercise.section === section);
    const sectionCompleted = exercises.filter((exercise) => exerciseResults[exercise.id]?.completed).length;
    const sectionScore = exercises.reduce((sum, exercise) => sum + clampScore(exerciseResults[exercise.id]?.score), 0);
    return {
      section,
      total: exercises.length,
      completed: sectionCompleted,
      progress: exercises.length ? Math.round((sectionScore / exercises.length) * 100) : 0
    };
  });

  return {
    total: exerciseCatalog.length,
    completed: completed.length,
    readiness: exerciseCatalog.length ? Math.round((scoreSum / exerciseCatalog.length) * 100) : 0,
    accuracy: completed.length ? Math.round((scoreSum / completed.length) * 100) : null,
    bySection
  };
}

function recordExercise(exerciseId, score) {
  if (!exerciseCatalog.some((exercise) => exercise.id === exerciseId)) return;
  const previous = exerciseResults[exerciseId];
  exerciseResults[exerciseId] = {
    completed: true,
    score: clampScore(score),
    attempts: (previous?.attempts || 0) + 1,
    updatedAt: new Date().toISOString()
  };
  saveExerciseResults();
  renderStats();
}

function getReadinessCopy(readiness) {
  if (readiness === 0) return { status: 'Your starting point', message: 'Start with one exercise. Every completed activity makes your estimate more accurate.' };
  if (readiness < 25) return { status: 'Early progress', message: 'You are building your base. Keep a steady rhythm and the percentage will follow.' };
  if (readiness < 50) return { status: 'Building momentum', message: 'Good work. A few more focused sessions will make your progress more visible.' };
  if (readiness < 75) return { status: 'Strong foundation', message: 'You are becoming more consistent. Challenge yourself with the high-difficulty readings.' };
  if (readiness < 90) return { status: 'Nearly there', message: 'Your preparation is looking strong. Keep practising the areas with the lowest progress.' };
  return { status: 'C1 within reach', message: 'Excellent consistency. Use the remaining exercises to confirm your level across every skill.' };
}

function renderStats() {
  const stats = getStats();
  const copy = getReadinessCopy(stats.readiness);
  const readinessPercent = document.getElementById('readiness-percent');
  const readinessRing = document.getElementById('readiness-ring');
  const readinessRingValue = document.getElementById('readiness-ring-value');
  const readinessBar = document.getElementById('readiness-bar');

  if (readinessPercent) readinessPercent.textContent = `${stats.readiness}%`;
  if (readinessRing) readinessRing.style.setProperty('--progress', `${stats.readiness}%`);
  if (readinessRingValue) readinessRingValue.textContent = `${stats.readiness}%`;
  if (readinessBar) readinessBar.style.width = `${stats.readiness}%`;
  document.getElementById('readiness-status').textContent = copy.status;
  document.getElementById('readiness-message').textContent = copy.message;
  document.getElementById('stats-completed').textContent = stats.completed;
  document.getElementById('stats-total').textContent = stats.total;
  document.getElementById('stats-accuracy').textContent = stats.accuracy === null ? '—' : `${stats.accuracy}%`;

  const breakdown = document.getElementById('stats-breakdown');
  breakdown.innerHTML = stats.bySection.map((area) => `
    <div class="stats-row">
      <div class="stats-row-head"><strong>${escapeHtml(area.section)}</strong><span>${area.completed} / ${area.total} completed · ${area.progress}%</span></div>
      <div class="stats-row-track"><span style="width: ${area.progress}%"></span></div>
    </div>
  `).join('');

  const nextArea = [...stats.bySection].sort((first, second) => first.progress - second.progress)[0];
  document.getElementById('stats-next').textContent = nextArea
    ? `Next focus: ${nextArea.section}. ${nextArea.completed < nextArea.total ? `You still have ${nextArea.total - nextArea.completed} exercise${nextArea.total - nextArea.completed === 1 ? '' : 's'} to complete there.` : 'Revisit it to improve your accuracy.'}`
    : 'Complete an exercise to see your next focus.';
}

const editor = document.getElementById('writing-editor');
const wordCount = document.getElementById('word-count');
const writingWorkspace = document.getElementById('writing-workspace');
const writingExample = document.getElementById('writing-example');
const writingDraftsKey = 'engli.writing-drafts.v1';
let writingDrafts = loadWritingDrafts();
let writingIndex = 0;
let currentWriting = writingQuestions[0] || null;

function loadWritingDrafts() {
  try {
    const stored = window.localStorage.getItem(writingDraftsKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveWritingDrafts() {
  try {
    window.localStorage.setItem(writingDraftsKey, JSON.stringify(writingDrafts));
  } catch (error) {
    // Drafts remain available for the current session when storage is unavailable.
  }
}

function updateWordCount() {
  const words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
}

function saveCurrentDraft() {
  if (!currentWriting) return;
  writingDrafts[currentWriting.id] = editor.value;
  saveWritingDrafts();
}

function renderWritingPrompt() {
  if (!writingQuestions.length) {
    document.getElementById('writing-title').textContent = 'No writing prompts are available yet.';
    return;
  }

  currentWriting = writingQuestions[writingIndex];
  document.getElementById('writing-progress').textContent = `Writing ${writingIndex + 1} / ${writingQuestions.length}`;
  document.getElementById('writing-category').textContent = currentWriting.category;
  document.getElementById('writing-title').textContent = currentWriting.title;
  document.getElementById('writing-meta').textContent = `${currentWriting.level} · ${currentWriting.wordRange}`;
  document.getElementById('writing-prompt').textContent = currentWriting.prompt;
  editor.value = writingDrafts[currentWriting.id] || '';
  updateWordCount();
  writingExample.hidden = true;
  writingWorkspace.classList.remove('has-example');
  document.getElementById('writing-example-title').textContent = currentWriting.title;
  document.getElementById('writing-example-level').textContent = currentWriting.level;
  document.getElementById('writing-example-text').textContent = currentWriting.example;
  document.getElementById('writing-previous').disabled = writingIndex === 0;
  document.getElementById('writing-next').textContent = writingIndex === writingQuestions.length - 1 ? 'Restart' : 'Next';
}

function moveWritingPrompt(nextIndex) {
  if (!writingQuestions.length) return;
  saveCurrentDraft();
  writingIndex = (nextIndex + writingQuestions.length) % writingQuestions.length;
  renderWritingPrompt();
}

editor?.addEventListener('input', () => {
  updateWordCount();
  saveCurrentDraft();
});

document.getElementById('save-draft')?.addEventListener('click', () => {
  saveCurrentDraft();
  showToast('Draft saved');
});

document.getElementById('submit-writing')?.addEventListener('click', () => {
  if (!editor.value.trim() || !currentWriting) {
    editor.focus();
    showToast('Write an answer before comparing it');
    return;
  }
  saveCurrentDraft();
  const words = editor.value.trim().split(/\s+/).length;
  const inRange = currentWriting.level === 'C1'
    ? words >= 260 && words <= 320
    : words >= 180 && words <= 250;
  const score = inRange ? 0.8 : words >= 100 ? 0.65 : 0.5;
  recordExercise(`writing-${currentWriting.id}`, score);
  writingExample.hidden = false;
  writingWorkspace.classList.add('has-example');
  showToast('Model answer shown · compare your writing');
});

document.getElementById('writing-previous')?.addEventListener('click', () => moveWritingPrompt(writingIndex - 1));
document.getElementById('writing-next')?.addEventListener('click', () => moveWritingPrompt(writingIndex + 1));

let grammarIndex = 0;
let selectedGrammar = null;
let currentGrammar = null;
const grammarOptions = document.getElementById('grammar-options');
const grammarFeedback = document.getElementById('grammar-feedback');
const grammarPrevious = document.getElementById('grammar-previous');
const grammarNext = document.getElementById('grammar-next');

function renderGrammarQuestion() {
  if (!grammarQuestions.length) {
    document.getElementById('grammar-prompt').textContent = 'No grammar questions are available yet.';
    grammarOptions.innerHTML = '';
    return;
  }

  currentGrammar = grammarQuestions[grammarIndex];
  document.getElementById('grammar-progress').textContent = `Question ${grammarIndex + 1} / ${grammarQuestions.length}`;
  document.getElementById('grammar-category').textContent = currentGrammar.category;
  document.getElementById('grammar-level').textContent = currentGrammar.level;
  document.getElementById('grammar-difficulty').textContent = currentGrammar.difficulty;
  document.getElementById('grammar-instruction').textContent = currentGrammar.level === 'C1' ? 'Choose the most precise option' : 'Choose the best option';
  document.getElementById('grammar-prompt').textContent = currentGrammar.prompt;
  grammarOptions.innerHTML = currentGrammar.options.map((option, index) => `
    <button type="button" data-index="${index}"><span>${String.fromCharCode(65 + index)}.</span>${escapeHtml(option)}</button>
  `).join('');
  grammarFeedback.textContent = '';
  grammarFeedback.className = 'feedback';
  selectedGrammar = null;
  grammarPrevious.disabled = grammarIndex === 0;
  grammarNext.textContent = grammarIndex === grammarQuestions.length - 1 ? 'Restart' : 'Next';
}

function moveGrammarQuestion(nextIndex) {
  if (!grammarQuestions.length) return;
  grammarIndex = (nextIndex + grammarQuestions.length) % grammarQuestions.length;
  renderGrammarQuestion();
}

grammarOptions?.addEventListener('click', (event) => {
  const option = event.target.closest('button[data-index]');
  if (!option) return;
  grammarOptions.querySelectorAll('button').forEach((item) => item.classList.remove('selected', 'correct', 'incorrect'));
  option.classList.add('selected');
  selectedGrammar = option;
  grammarFeedback.textContent = '';
  grammarFeedback.className = 'feedback';
});

document.getElementById('check-answer')?.addEventListener('click', () => {
  if (!selectedGrammar || !currentGrammar) {
    grammarFeedback.textContent = 'Choose an option first.';
    grammarFeedback.className = 'feedback error';
    return;
  }

  const correct = Number(selectedGrammar.dataset.index) === currentGrammar.answer;
  selectedGrammar.classList.remove('selected');
  selectedGrammar.classList.add(correct ? 'correct' : 'incorrect');
  grammarFeedback.className = `feedback${correct ? '' : ' error'}`;
  grammarFeedback.textContent = correct ? `Correct — ${currentGrammar.explanation}` : `Not quite. ${currentGrammar.explanation}`;
  recordExercise(`grammar-${currentGrammar.id}`, correct ? 1 : 0);

  if (!correct) grammarOptions.querySelectorAll('button').forEach((item) => {
    if (Number(item.dataset.index) === currentGrammar.answer) item.classList.add('correct');
  });
});

grammarPrevious?.addEventListener('click', () => moveGrammarQuestion(grammarIndex - 1));
grammarNext?.addEventListener('click', () => moveGrammarQuestion(grammarIndex + 1));

const readingSearch = document.getElementById('reading-search');
const readingFilters = document.querySelectorAll('.reading-filter');
const readingLibraryGrid = document.getElementById('reading-library-grid');
const readingResultsCount = document.getElementById('reading-results-count');
const readingOptions = document.getElementById('reading-options');
const readingFeedback = document.getElementById('reading-feedback');
const readingCheck = document.getElementById('reading-check');
const readingTotal = document.getElementById('reading-total');
let currentReading = readingLibrary[0] || null;
let selectedReading = null;
let activeReadingFilter = 'all';

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  return String(value ?? '').replace(/[&<>'"]/g, (character) => entities[character]);
}

function getVisibleReadings() {
  const query = (readingSearch?.value || '').trim().toLowerCase();
  return readingLibrary.filter((reading) => {
    const matchesFilter = activeReadingFilter === 'all' || reading.difficulty === activeReadingFilter;
    const searchableText = [reading.title, reading.category, reading.level, reading.author, reading.dek, ...(reading.body || [])].join(' ').toLowerCase();
    return matchesFilter && (!query || searchableText.includes(query));
  });
}

function renderReading() {
  if (!currentReading) return;

  document.getElementById('reading-category').textContent = currentReading.category;
  document.getElementById('reading-date').textContent = currentReading.date;
  document.getElementById('reading-time').textContent = `${currentReading.time} min read`;
  document.getElementById('reading-difficulty').textContent = currentReading.difficulty;
  document.getElementById('reading-title').textContent = currentReading.title;
  document.getElementById('reading-dek').textContent = currentReading.dek;
  document.getElementById('reading-author-name').textContent = currentReading.author;
  document.getElementById('reading-author-publication').textContent = currentReading.publication;
  document.getElementById('reading-question').textContent = currentReading.question;
  document.getElementById('reading-quiz-count').textContent = `1 / ${currentReading.options.length}`;

  const paragraphs = currentReading.body || [];
  const firstParagraph = paragraphs[0] ? `<p>${escapeHtml(paragraphs[0])}</p>` : '';
  const quote = paragraphs[1] ? `<blockquote class="pull-quote">${escapeHtml(paragraphs[1])}</blockquote>` : '';
  const finalParagraph = paragraphs[2] ? `<p>${escapeHtml(paragraphs[2])}</p>` : '';
  document.getElementById('reading-body').innerHTML = `${firstParagraph}${quote}${finalParagraph}`;

  readingOptions.innerHTML = currentReading.options.map((option, index) => `
    <button type="button" data-index="${index}">
      <span>${String.fromCharCode(65 + index)}.</span>${escapeHtml(option)}
    </button>
  `).join('');
  selectedReading = null;
  readingFeedback.textContent = '';
  readingFeedback.className = 'feedback';
}

function renderLibrary() {
  const visibleReadings = getVisibleReadings();
  readingResultsCount.textContent = `Showing ${visibleReadings.length} of ${readingLibrary.length} readings`;

  if (!visibleReadings.length) {
    readingLibraryGrid.innerHTML = '<p class="empty-state">No readings match that search.</p>';
    return;
  }

  readingLibraryGrid.innerHTML = visibleReadings.map((reading) => `
    <button class="library-item${reading.id === currentReading?.id ? ' active' : ''}" type="button" data-reading-id="${reading.id}">
      <span class="library-item-meta"><strong>${escapeHtml(reading.difficulty)}</strong><span>${escapeHtml(reading.level)} · ${reading.time} min</span></span>
      <h3>${escapeHtml(reading.title)}</h3>
      <p>${escapeHtml(reading.category)}</p>
    </button>
  `).join('');
}

function loadReading(id) {
  const nextReading = readingLibrary.find((reading) => reading.id === id);
  if (!nextReading) return;
  currentReading = nextReading;
  renderReading();
  renderLibrary();
}

readingOptions?.addEventListener('click', (event) => {
  const option = event.target.closest('button[data-index]');
  if (!option) return;
  readingOptions.querySelectorAll('button').forEach((item) => item.classList.remove('selected', 'correct', 'incorrect'));
  option.classList.add('selected');
  selectedReading = option;
  readingFeedback.textContent = '';
  readingFeedback.className = 'feedback';
});

readingCheck?.addEventListener('click', () => {
  if (!selectedReading || !currentReading) {
    readingFeedback.textContent = 'Choose an answer first.';
    readingFeedback.className = 'feedback error';
    return;
  }

  const correct = Number(selectedReading.dataset.index) === currentReading.answer;
  selectedReading.classList.remove('selected');
  selectedReading.classList.add(correct ? 'correct' : 'incorrect');
  readingFeedback.className = `feedback${correct ? '' : ' error'}`;
  readingFeedback.textContent = correct ? `Correct — ${currentReading.explanation}` : `Not quite. ${currentReading.explanation}`;
  recordExercise(`reading-${currentReading.id}`, correct ? 1 : 0);

  if (!correct) readingOptions.querySelectorAll('button').forEach((item) => {
    if (Number(item.dataset.index) === currentReading.answer) item.classList.add('correct');
  });
});

readingLibraryGrid?.addEventListener('click', (event) => {
  const card = event.target.closest('[data-reading-id]');
  if (!card) return;
  loadReading(Number(card.dataset.readingId));
  document.getElementById('reading-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

readingSearch?.addEventListener('input', renderLibrary);
readingFilters.forEach((filter) => filter.addEventListener('click', () => {
  activeReadingFilter = filter.dataset.filter;
  readingFilters.forEach((item) => {
    const active = item === filter;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderLibrary();
}));

if (readingTotal) readingTotal.textContent = readingLibrary.length;
renderStats();
renderWritingPrompt();
renderGrammarQuestion();
renderReading();
renderLibrary();
