// PBAC Training Course - Main System
// ======================================================

class PBACourse {
    constructor() {
        // Course state
        this.currentLessonId = null;
        this.currentLevel = 'beginner';
        this.completedLessons = new Set();
        this.scores = {};
        this.weakAreas = [];
        this.strengths = [];
        this.timeSpent = 0;
        this.confidenceLevels = {};
        this.startTime = Date.now();
        
        // DOM elements
        this.lessonContainer = null;
        this.courseNav = null;
        this.progressFill = null;
        this.progressText = null;
        this.currentScoreEl = null;
        this.completedLessonsEl = null;
        this.masteredTopicsEl = null;
        this.avgScoreEl = null;
        this.confidenceLevelEl = null;
        
        // Systems
        this.animations = null;
        this.quiz = null;
        this.courseData = null;
        
        // Timeline
        this.activityLog = [];
        
        this.init();
    }
    
    init() {
        console.log('Initializing PBAC Course...');

        // Get DOM elements
        this.lessonContainer = document.getElementById('lessonContainer');
        this.courseNav = document.getElementById('courseNav');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.currentScoreEl = document.getElementById('currentScore');
        this.completedLessonsEl = document.getElementById('completedLessons');
        this.masteredTopicsEl = document.getElementById('masteredTopics');
        this.avgScoreEl = document.getElementById('avgScore');
        this.confidenceLevelEl = document.getElementById('confidenceLevel');

        // Load course data
        this.loadCourseData();

        // Initialize systems
        this.animations = window.animations || null;
        this.quiz = window.quiz || null;

        // Load saved progress
        this.loadProgress();

        // Build navigation
        this.buildNavigation();

        // Resume the last-viewed lesson if we have one, else fall back to first lesson
        const resumeLessonId = this.currentLessonId && this.findLesson(this.currentLessonId)
            ? this.currentLessonId
            : (this.getFirstLesson() ? this.getFirstLesson().id : null);

        if (resumeLessonId) {
            this.showLesson(resumeLessonId);
        }

        // Placement test: on first visit (zero completed lessons and
        // no record of having been offered the test), show a one-time overlay
        // inviting the user to test out of Foundations. Passing auto-completes
        // lessons 1-5 (AuthZ intro, RBAC/ABAC/ReBAC, policy anatomy, default-deny, business case).
        if (this.completedLessons.size === 0 && !this._placementOffered()) {
            // Defer so the loading screen is hidden first
            setTimeout(() => this.offerPlacementTest(), 300);
        }

        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        // Set up interval to track time
        setInterval(() => this.updateTime(), 1000);

        // Add event listeners
        this.setupEventListeners();

        // T5.4 - Restore the learning-path badge if previously chosen
        this._restoreLearningPath();

        // Mobile nav toggle
        const navToggle = document.getElementById('navToggle');
        const sidebar = document.querySelector('.sidebar');
        if (navToggle && sidebar) {
            navToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
            // Close drawer when a nav item is clicked (mobile)
            sidebar.addEventListener('click', (e) => {
                if (e.target.closest('.nav-item') && window.innerWidth <= 900) {
                    sidebar.classList.remove('mobile-open');
                }
            });
        }
    }

    findLesson(lessonId) {
        if (!this.courseData) return null;
        for (const level of Object.values(this.courseData.levels)) {
            if (level.lessons && level.lessons[lessonId]) {
                return level.lessons[lessonId];
            }
        }
        return null;
    }

    // T5.3 - Placement test plumbing. We persist a single boolean in
    // localStorage so we only ever auto-offer the test once per browser.
    _placementOffered() {
        try { return localStorage.getItem('pbacCoursePlacementOffered') === '1'; }
        catch (e) { return false; }
    }
    _markPlacementOffered() {
        try { localStorage.setItem('pbacCoursePlacementOffered', '1'); }
        catch (e) { /* ignore quota */ }
    }

    offerPlacementTest() {
        // Don't offer if the user has any completed lessons or has dismissed before
        if (this.completedLessons.size > 0 || this._placementOffered()) return;
        this._markPlacementOffered();

        const overlay = document.createElement('div');
        overlay.id = 'placementOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 20000; padding: 1rem;
        `;
        overlay.innerHTML = `
            <div style="background: var(--surface-color); border-radius: 12px; padding: 2rem; max-width: 540px; box-shadow: var(--shadow-lg);">
                <h2 style="color: var(--ai-blue); margin-bottom: 0.5rem;">🎓 Welcome</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    Two quick choices to tailor the course to you. Both are reversible from the header.
                </p>

                <h3 style="color: var(--text-primary); font-size: 0.95rem; margin: 1rem 0 0.5rem;">1. Pick a learning path</h3>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">
                    Same content - different recommended order and emphasis in the side panel.
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1.25rem;">
                    <label style="padding: 0.75rem; background: var(--surface-light); border-radius: 8px; border: 2px solid var(--ai-blue); cursor: pointer;">
                        <input type="radio" name="path" value="builder" checked style="margin-bottom: 0.4rem;">
                        <strong>🔧 Builder</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Code-first. Rego → Cedar → OpenFGA → Capstone. Less theory, more shipping.</div>
                    </label>
                    <label style="padding: 0.75rem; background: var(--surface-light); border-radius: 8px; border: 2px solid transparent; cursor: pointer;">
                        <input type="radio" name="path" value="researcher" style="margin-bottom: 0.4rem;">
                        <strong>🔬 Researcher</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Model-first. Architecture → verification → ReBAC theory. Rigor + proofs.</div>
                    </label>
                    <label style="padding: 0.75rem; background: var(--surface-light); border-radius: 8px; border: 2px solid transparent; cursor: pointer;">
                        <input type="radio" name="path" value="leader" style="margin-bottom: 0.4rem;">
                        <strong>📊 Leader</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Governance-first. Business case → Immuta/PlainID → migration. Strategy + risk, less code.</div>
                    </label>
                </div>

                <h3 style="color: var(--text-primary); font-size: 0.95rem; margin: 1rem 0 0.5rem;">2. Already know the foundations?</h3>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">
                    Take a 5-question placement test to skip Lessons 1-5 (pass at 60%).
                </p>
                <div style="display: flex; gap: 0.75rem;">
                    <button class="btn-primary" id="placementStart" style="flex: 1;">📋 Take placement test</button>
                    <button class="btn-secondary" id="placementSkip" style="flex: 1;">Start from Lesson 1</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Highlight the selected path's label border
        overlay.querySelectorAll('input[name="path"]').forEach(r => {
            r.addEventListener('change', (e) => {
                overlay.querySelectorAll('input[name="path"]').forEach(other => {
                    other.parentElement.style.border = '2px solid transparent';
                });
                e.target.parentElement.style.border = '2px solid var(--ai-blue)';
            });
        });

        const choosePath = () => {
            const checked = overlay.querySelector('input[name="path"]:checked');
            const path = checked ? checked.value : 'builder';
            this.setLearningPath(path);
        };

        overlay.querySelector('#placementStart')?.addEventListener('click', () => {
            choosePath();
            overlay.remove();
            this.startPlacementTest();
        });
        overlay.querySelector('#placementSkip')?.addEventListener('click', () => {
            choosePath();
            overlay.remove();
        });
    }

    // T5.4 - Persist the learning path. We don't reorder lessons yet (Phase 11
    // work); we DO show a path badge in the header and persist it so the
    // choice survives reload. The recommended next-lesson from each path is
    // surfaced in the activity log so first-time users get a clear next step.
    setLearningPath(path) {
        const valid = ['builder', 'researcher', 'leader'];
        if (!valid.includes(path)) path = 'builder';
        this.learningPath = path;
        try { localStorage.setItem('pbacCourseLearningPath', path); } catch (e) { /* quota */ }

        // Show a path badge in the header next to the progress text
        const labels = { builder: '🔧 Builder', researcher: '🔬 Researcher', leader: '📊 Leader' };
        let badge = document.getElementById('pathBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'pathBadge';
            badge.style.cssText = 'margin-left: 0.75rem; padding: 0.15rem 0.5rem; background: var(--primary-bg); color: #c5d4e3; border: 1px solid var(--ai-blue); border-radius: 9999px; font-size: 0.75rem; font-weight: 600;';
            const progress = document.querySelector('.progress-container');
            if (progress) progress.appendChild(badge);
        }
        badge.textContent = labels[path] || labels.builder;

        // Recommended first lesson per path (PBAC edition)
        const startByPath = {
            builder: 'rego_foundations',     // Lesson 6: Rego foundations
            researcher: 'policy_anatomy',    // Lesson 3: PEP/PDP/PIP/PAP architecture
            leader: 'pbac_business_case'     // Lesson 5: business case / governance
        };
        // We don't auto-jump (the user might want placement test first),
        // but log the suggested starting point so it's visible in the console.
        const recId = startByPath[path] || startByPath.builder;
        const rec = this.findLesson(recId);
        if (rec) this.logActivity(`Learning path: ${path}. Recommended start: Lesson ${rec.number} - ${rec.title}`);
    }

    // Restore the path badge and stored value on reload.
    _restoreLearningPath() {
        let path = 'builder';
        try { path = localStorage.getItem('pbacCourseLearningPath') || 'builder'; } catch (e) { /* quota */ }
        this.learningPath = path;
        const labels = { builder: '🔧 Builder', researcher: '🔬 Researcher', leader: '📊 Leader' };
        let badge = document.getElementById('pathBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'pathBadge';
            badge.style.cssText = 'margin-left: 0.75rem; padding: 0.15rem 0.5rem; background: var(--primary-bg); color: #c5d4e3; border: 1px solid var(--ai-blue); border-radius: 9999px; font-size: 0.75rem; font-weight: 600;';
            const progress = document.querySelector('.progress-container');
            if (progress) progress.appendChild(badge);
        }
        badge.textContent = labels[path] || labels.builder;
    }

    // The placement test draws one question from each of the 5 Foundations
    // quizzes (Lessons 1-5) so passing requires breadth, not one topic.
    startPlacementTest() {
        const foundationsIds = ['access_control_intro', 'rbac_abac_rebac', 'policy_anatomy', 'default_deny', 'pbac_business_case'];
        const questions = [];
        for (const id of foundationsIds) {
            const lesson = this.findLesson(id);
            if (!lesson || !lesson.quiz || !lesson.quiz.questions.length) continue;
            // Use the first question from each lesson's quiz (deterministic; the
            // quiz system shuffles at runtime, but the placement test is its own
            // path so we just pick one per topic).
            const q = lesson.quiz.questions[0];
            questions.push({ ...q, concept: q.concept || id });
        }
        if (questions.length === 0) return;

        const overlay = document.createElement('div');
        overlay.id = 'placementTest';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95);
            display: flex; align-items: flex-start; justify-content: center;
            z-index: 20000; padding: 2rem 1rem; overflow-y: auto;
        `;
        const passingScore = 60;
        const total = questions.length;
        const answers = new Array(total).fill(null);

        const render = () => {
            let body = `<div style="background: var(--surface-color); border-radius: 12px; padding: 2rem; max-width: 640px; width: 100%;">`;
            body += `<h2 style="color: var(--ai-blue); margin-bottom: 0.5rem;">📋 Placement Test</h2>`;
            body += `<p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">${total} questions, pass at ${passingScore}% to skip Foundations.</p>`;
            questions.forEach((q, qi) => {
                body += `<div style="margin: 1.25rem 0; padding: 1rem; background: var(--surface-light); border-radius: 8px;">`;
                body += `<p style="font-weight: 600; margin-bottom: 0.75rem;">Q${qi + 1}. ${q.question}</p>`;
                q.options.forEach((opt, oi) => {
                    const selected = answers[qi] === oi;
                    const isAnswered = answers[qi] !== null;
                    let cls = 'quiz-option';
                    if (selected) cls += ' selected';
                    body += `<div class="${cls}" data-q="${qi}" data-o="${oi}" role="button" tabindex="0" style="padding: 0.5rem; margin: 0.25rem 0; border-radius: 6px; cursor: pointer;">${String.fromCharCode(65 + oi)}. ${opt.text}</div>`;
                });
                body += `</div>`;
            });
            body += `<button class="btn-primary" id="placementSubmit" style="width: 100%; margin-top: 1rem;">Submit placement test</button>`;
            body += `<button class="btn-secondary" id="placementCancel" style="width: 100%; margin-top: 0.5rem;">Cancel</button>`;
            body += `</div>`;
            overlay.innerHTML = body;

            overlay.querySelectorAll('.quiz-option').forEach(el => {
                const handle = () => {
                    const qi = parseInt(el.dataset.q, 10);
                    const oi = parseInt(el.dataset.o, 10);
                    if (answers[qi] !== null) return; // lock once answered
                    answers[qi] = oi;
                    el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                    el.classList.add('selected');
                };
                el.addEventListener('click', handle);
                el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
            });

            overlay.querySelector('#placementSubmit')?.addEventListener('click', () => {
                if (answers.some(a => a === null)) {
                    alert('Please answer all questions before submitting.');
                    return;
                }
                let correct = 0;
                questions.forEach((q, qi) => { if (q.options[answers[qi]].isCorrect) correct++; });
                const score = Math.round((correct / total) * 100);
                this.scorePlacementTest(score, correct, total, passingScore, foundationsIds);
                overlay.remove();
            });
            overlay.querySelector('#placementCancel')?.addEventListener('click', () => overlay.remove());
        };
        render();
        document.body.appendChild(overlay);
    }

    // On pass, mark all Foundations lessons complete with a synthetic 100%
    // score so the rest of the course's prereq gating opens up.
    scorePlacementTest(score, correct, total, passingScore, foundationsIds) {
        const passed = score >= passingScore;
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 20000; padding: 1rem;
        `;
        overlay.innerHTML = `
            <div style="background: var(--surface-color); border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center;">
                <h2 style="color: ${passed ? 'var(--ai-green)' : 'var(--ai-orange)'}; margin-bottom: 0.5rem;">
                    ${passed ? '🎉 Passed!' : '📚 Keep going'}
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    You scored ${score}% (${correct} of ${total}).
                    ${passed
                        ? 'Foundations (Lessons 1-5) marked complete. Jump to Lesson 6.'
                        : 'You need 60% to skip Foundations. Start from Lesson 1 - you can retake the test any time from the nav header.'}
                </p>
                <button class="btn-primary" id="placementDone" style="width: 100%;">${passed ? 'Jump to Lesson 6' : 'Start from Lesson 1'}</button>
            </div>
        `;
        document.body.appendChild(overlay);

        if (passed) {
            // Mark all 5 Foundations lessons complete with a synthetic 100% score,
            // so the next-tier lessons unlock. Log it so it's visible in the activity feed.
            foundationsIds.forEach(id => {
                this.completedLessons.add(id);
                this.scores[id] = 100;
                this.confidenceLevels[id] = 100; // mastered
            });
            this.saveProgress();
            this.updateNavigation();
            this.updateProgress();
            this.logActivity(`Placement test passed (${score}%); Foundations marked complete`);
        } else {
            this.logActivity(`Placement test failed (${score}%); starting from Lesson 1`);
        }

        overlay.querySelector('#placementDone')?.addEventListener('click', () => {
            overlay.remove();
            // On pass jump to Lesson 6 (rego_foundations); on fail start at Lesson 1.
            // Either way the user is now in the course proper.
            const targetId = passed ? 'rego_foundations' : 'access_control_intro';
            if (this.findLesson(targetId)) this.showLesson(targetId);
        });
    }

    getFirstLesson() {
        if (!this.courseData) return null;

        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];

        for (const levelKey of levelOrder) {
            const level = this.courseData.levels[levelKey];
            if (level && level.lessons) {
                const firstLessonId = Object.keys(level.lessons)[0];
                if (firstLessonId) {
                    return level.lessons[firstLessonId];
                }
            }
        }
        
        return null;
    }
    
    loadCourseData() {
        if (typeof COURSE_DATA !== 'undefined') {
            this.courseData = COURSE_DATA;
            console.log('Course data loaded successfully');
        } else {
            console.error('Course data not found');
            this.courseData = { levels: {} };
        }
    }
    
    loadProgress() {
        try {
            const saved = localStorage.getItem('pbacCourseProgress');
            if (saved) {
                const progress = JSON.parse(saved);
                this.completedLessons = new Set(progress.completedLessons || []);
                this.scores = progress.scores || {};
                this.weakAreas = progress.weakAreas || [];
                this.timeSpent = progress.timeSpent || 0;
                this.confidenceLevels = progress.confidenceLevels || {};
                this.currentLessonId = progress.currentLessonId || null;
                console.log('Progress loaded:', progress);
            }
        } catch (e) {
            console.log('No saved progress found');
        }
    }

    saveProgress() {
        try {
            const progress = {
                completedLessons: Array.from(this.completedLessons),
                scores: this.scores,
                weakAreas: this.weakAreas,
                timeSpent: this.timeSpent,
                confidenceLevels: this.confidenceLevels,
                currentLessonId: this.currentLessonId,
                learningPath: this.learningPath
            };
            localStorage.setItem('pbacCourseProgress', JSON.stringify(progress));
            // Also push to Supabase if the user is logged in (auth.js)
            if (window.authSync && window.authSync.isEnabled && window.authSync.isEnabled()) {
                window.authSync.syncToServer();
            }
        } catch (e) {
            console.error('Failed to save progress:', e);
        }
    }
    
    setupEventListeners() {
        // Panel toggle
        const togglePanel = document.getElementById('togglePanel');
        const interactivePanel = document.getElementById('interactivePanel');

        if (togglePanel && interactivePanel) {
            togglePanel.addEventListener('click', () => {
                const isHidden = interactivePanel.style.display === 'none';
                interactivePanel.style.display = isHidden ? 'flex' : 'none';
                togglePanel.textContent = isHidden ? '▶' : '◀';
            });
        }

        // Modal closes - animation modal
        const closeModal = document.querySelector('#animationModal .close-modal');
        const animationModal = document.getElementById('animationModal');

        if (closeModal && animationModal) {
            closeModal.addEventListener('click', () => {
                animationModal.classList.remove('show');
            });
        }

        // Completion modal close (the modal was missing a close button in the original HTML;
        // index.html now has one). Handle outside-click for both modals.
        const completionModal = document.getElementById('completionModal');
        const closeCompletion = completionModal?.querySelector('.close-modal');
        const restartCourse = document.getElementById('restartCourse');
        const continueLearning = document.getElementById('continueLearning');

        if (closeCompletion) {
            closeCompletion.addEventListener('click', () => {
                completionModal.classList.remove('show');
            });
        }

        if (restartCourse) {
            restartCourse.addEventListener('click', () => {
                completionModal.classList.remove('show');
                this.restartCourse();
            });
        }

        if (continueLearning) {
            continueLearning.addEventListener('click', () => {
                completionModal.classList.remove('show');
            });
        }

        // Outside-click dismissal for both modals
        window.addEventListener('click', (e) => {
            if (e.target === animationModal) {
                animationModal.classList.remove('show');
            }
            if (e.target === completionModal) {
                completionModal.classList.remove('show');
            }
        });

        // Esc key dismisses modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (animationModal) animationModal.classList.remove('show');
                if (completionModal) completionModal.classList.remove('show');
            }
        });

        // Progress menu: export / import / reset
        const exportBtn = document.getElementById('exportProgress');
        const importBtn = document.getElementById('importProgress');
        const resetBtn = document.getElementById('resetProgress');
        const importFileInput = document.getElementById('importFileInput');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportProgress());
        }
        if (importBtn) {
            importBtn.addEventListener('click', () => importFileInput?.click());
        }
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.importProgress(file);
                e.target.value = ''; // allow re-importing the same file
            });
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.confirmResetProgress());
        }
    }

    // Export all progress as a downloadable JSON file.
    // Works with CCleaner: download before clearing cache, import after.
    // Works with multiple users: each user keeps their own JSON file.
    exportProgress() {
        try {
            const data = {
                version: '2.3.0',
                exportedAt: new Date().toISOString(),
                learningPath: this.learningPath || 'builder',
                completedLessons: Array.from(this.completedLessons),
                scores: this.scores,
                weakAreas: this.weakAreas,
                timeSpent: this.timeSpent,
                confidenceLevels: this.confidenceLevels,
                currentLessonId: this.currentLessonId,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `pbac-course-progress-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.logActivity('Progress exported to file');
        } catch (e) {
            console.error('Export failed:', e);
            alert('Could not export progress: ' + e.message);
        }
    }

    // Import progress from a previously downloaded JSON file.
    async importProgress(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data || !Array.isArray(data.completedLessons)) {
                throw new Error('Invalid progress file format');
            }

            this.completedLessons = new Set(data.completedLessons);
            this.scores = data.scores || {};
            this.weakAreas = data.weakAreas || [];
            this.timeSpent = data.timeSpent || 0;
            this.confidenceLevels = data.confidenceLevels || {};
            this.currentLessonId = data.currentLessonId || null;

            if (data.learningPath) {
                this.setLearningPath(data.learningPath);
            }

            this.saveProgress();
            this.buildNavigation();
            this.updateProgress();

            // Resume the lesson
            const resumeId = this.currentLessonId && this.findLesson(this.currentLessonId)
                ? this.currentLessonId
                : (this.getFirstLesson() ? this.getFirstLesson().id : null);
            if (resumeId) this.showLesson(resumeId);

            this.logActivity(`Progress imported from ${file.name}`);

            // Confirm to the user
            const count = this.completedLessons.size;
            const total = Object.keys(this.scores).length;
            alert(`Progress loaded: ${count} lessons completed, ${total} quiz scores, ${Math.round(this.timeSpent / 60)} minutes spent.`);
        } catch (e) {
            console.error('Import failed:', e);
            alert('Could not load progress: ' + e.message);
        }
    }

    // Confirm before nuking all progress (more polite than instant destroy).
    confirmResetProgress() {
        if (this.completedLessons.size === 0) {
            alert('No progress to reset.');
            return;
        }
        if (confirm(`This will permanently delete ${this.completedLessons.size} completed lessons and all quiz scores. Export first if you want a backup.\n\nContinue?`)) {
            this.restartCourse();
        }
    }
    
    buildNavigation() {
        if (!this.courseNav || !this.courseData) return;
        
        let html = '';
        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
        
        levelOrder.forEach(levelKey => {
            const level = this.courseData.levels[levelKey];
            if (!level) return;
            
            // Add level header
            html += `
                <li class="nav-section-header" style="border-left: 3px solid ${level.color};">
                    <span style="color: var(--text-primary); font-weight: 600;">${level.icon} ${level.name}</span>
                </li>
            `;
            
            // Add lessons
            if (level.lessons) {
                Object.values(level.lessons).forEach(lesson => {
                    const isCompleted = this.completedLessons.has(lesson.id);
                    const isCurrent = this.currentLessonId === lesson.id;
                    const isUnlocked =
                        (lesson.prerequisites.length === 0 || 
                         lesson.prerequisites.every(prereq => this.completedLessons.has(prereq)));
                    
                    let classes = 'nav-item';
                    if (isCompleted) classes += ' completed';
                    if (isCurrent) classes += ' active';
                    if (!isUnlocked) classes += ' locked';
                    
                    html += `
                        <li class="${classes}" data-lesson="${lesson.id}" tabindex="0" aria-label="${isUnlocked ? 'Open lesson' : 'Locked lesson'}: ${lesson.number}. ${lesson.title}">
                            <span class="nav-indicator" aria-hidden="true"></span>
                            <span class="lesson-title">${lesson.number}. ${lesson.title}</span>
                            ${lesson.level ? `<span class="level-badge ${lesson.level}">${lesson.level.toUpperCase()}</span>` : ''}
                        </li>
                    `;
                });
            }
        });

        this.courseNav.innerHTML = html;

        // Add event listeners (click + keyboard activation)
        document.querySelectorAll('.nav-item').forEach(item => {
            const open = () => {
                const lessonId = item.dataset.lesson;
                if (lessonId && !item.classList.contains('locked')) {
                    this.showLesson(lessonId);
                }
            };
            item.addEventListener('click', open);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });
        });
    }
    
    showLesson(lessonId) {
        if (!this.courseData || !this.lessonContainer) return;

        // If switching lessons, cancel any in-progress quiz (and its timer)
        if (this.currentLessonId !== lessonId && this.quiz && this.quiz.currentQuiz) {
            this.quiz.cancelQuiz();
        }

        this.currentLessonId = lessonId;

        // Find the lesson
        let lesson = null;
        let levelKey = null;

        for (const [level, data] of Object.entries(this.courseData.levels)) {
            if (data.lessons && data.lessons[lessonId]) {
                lesson = data.lessons[lessonId];
                levelKey = level;
                break;
            }
        }

        if (!lesson) {
            console.error('Lesson not found:', lessonId);
            return;
        }

        this.currentLevel = levelKey;

        // Compute prev/next lessons for navigation buttons
        const nav = this.getAdjacentLessons(lessonId);

        // Update lesson content
        const content = `
            <div class="lesson-header">
                <div class="lesson-number">${lesson.number}</div>
                <div>
                    <h2 class="lesson-title">${lesson.title}</h2>
                    <p class="lesson-subtitle">${lesson.subtitle}</p>
                </div>
                <div class="level-badge ${levelKey}">${levelKey.toUpperCase()}</div>
            </div>

            <div class="lesson-content">
                ${lesson.content}
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 2rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn-primary" onclick="course.startQuiz('${lessonId}')">
                    📝 Start Knowledge Check
                </button>
                ${lesson.animation ?
                    `<button class="btn-secondary" onclick="course.startAnimation('${lessonId}')">
                        🎮 Interactive Lab
                    </button>` : ''}
            </div>

            <div class="lesson-nav-buttons" style="display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                <button class="btn-secondary" ${nav.prev ? `onclick="course.showLesson('${nav.prev.id}')"` : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
                    ← Previous: ${nav.prev ? nav.prev.title : 'Start of course'}
                </button>
                <button class="btn-primary" ${nav.next ? `onclick="course.showLesson('${nav.next.id}')"` : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
                    ${nav.next ? `Next: ${nav.next.title} →` : 'Course complete →'}
                </button>
            </div>
        `;

        this.lessonContainer.innerHTML = content;

        // PBAC intentionally defines no mountable labs: lessons use
        // renderPolicyLab() hint banners pointing at the Policy Lab panel.
        // The guard below is dead framework code kept for GenAI-shell parity.
        if (window.mountInteractiveLabs) {
            window.mountInteractiveLabs(this.lessonContainer);
        }

        // Start animation if specified
        if (lesson.animation) {
            this.startAnimation(lessonId);
        }

        // Update navigation
        this.updateNavigation();

        // Update progress
        this.updateProgress();

        // Mark as current
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.lesson === lessonId) {
                item.classList.add('active');
            }
        });

        // Scroll to top
        this.lessonContainer.scrollTop = 0;

        // Persist the current lesson for resume-on-reload
        this.saveProgress();

        // Log activity
        this.logActivity(`Started lesson: ${lesson.title}`);
    }

    // Return the previous and next lessons in level order, ignoring the lesson itself
    getAdjacentLessons(lessonId) {
        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
        const flat = [];
        levelOrder.forEach(levelKey => {
            const level = this.courseData.levels[levelKey];
            if (!level || !level.lessons) return;
            // Preserve insertion order of lessons within a level
            Object.values(level.lessons).forEach(l => flat.push(l));
        });
        const idx = flat.findIndex(l => l.id === lessonId);
        return {
            prev: idx > 0 ? flat[idx - 1] : null,
            next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null
        };
    }
    
    startQuiz(lessonId) {
        if (!this.courseData || !this.quiz) return;
        
        let lesson = null;
        for (const level of Object.values(this.courseData.levels)) {
            if (level.lessons && level.lessons[lessonId]) {
                lesson = level.lessons[lessonId];
                break;
            }
        }
        
        if (!lesson || !lesson.quiz) {
            console.error('Lesson or quiz not found:', lessonId);
            return;
        }
        
        this.quiz.startQuiz(lesson.quiz);
        this.logActivity(`Started quiz: ${lesson.quiz.title}`);
    }
    
    startAnimation(lessonId) {
        if (!this.courseData || !this.animations) return;
        
        let lesson = null;
        for (const level of Object.values(this.courseData.levels)) {
            if (level.lessons && level.lessons[lessonId]) {
                lesson = level.lessons[lessonId];
                break;
            }
        }
        
        if (!lesson || !lesson.animation) {
            console.error('Lesson or animation not found:', lessonId);
            return;
        }
        
        this.animations.startAnimation(lesson.animation.type, lesson.animation);
        this.logActivity(`Started animation: ${lesson.animation.title}`);
    }
    
    updateNavigation() {
        if (!this.courseNav) return;
        
        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
        
        for (const levelKey of levelOrder) {
            const level = this.courseData.levels[levelKey];
            if (!level || !level.lessons) continue;
            
            for (const [lessonId, lesson] of Object.entries(level.lessons)) {
                const navItem = document.querySelector(`[data-lesson="${lessonId}"]`);
                if (!navItem) continue;
                
                const isUnlocked = lesson.prerequisites.length === 0 || 
                    lesson.prerequisites.every(prereq => this.completedLessons.has(prereq));
                
                if (isUnlocked) {
                    navItem.classList.remove('locked');
                    navItem.style.cursor = 'pointer';
                } else {
                    navItem.classList.add('locked');
                    navItem.style.cursor = 'not-allowed';
                }
            }
        }
        
        this.saveProgress();
    }
    
    updateProgress() {
        if (!this.progressFill || !this.progressText) return;

        let totalLessons = 0;
        let completedLessons = 0;

        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];

        for (const levelKey of levelOrder) {
            const level = this.courseData.levels[levelKey];
            if (!level || !level.lessons) continue;

            for (const [lessonId, lesson] of Object.entries(level.lessons)) {
                const isUnlocked = lesson.prerequisites.length === 0 ||
                    lesson.prerequisites.every(prereq => this.completedLessons.has(prereq));

                if (isUnlocked) {
                    totalLessons++;
                }

                if (this.completedLessons.has(lessonId)) {
                    completedLessons++;
                }
            }
        }

        const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
        this.progressFill.style.width = `${progress}%`;
        // ARIA for assistive tech
        if (this.progressFill) {
            this.progressFill.setAttribute('role', 'progressbar');
            this.progressFill.setAttribute('aria-label', 'Course completion progress');
            this.progressFill.setAttribute('aria-valuenow', Math.round(progress));
            this.progressFill.setAttribute('aria-valuemin', 0);
            this.progressFill.setAttribute('aria-valuemax', 100);
        }

        const currentLevel = this.courseData.levels[this.currentLevel];
        this.progressText.textContent = currentLevel ?
            `${currentLevel.icon} ${currentLevel.name}` : 'PBAC Course';

        // Update sidebar stats
        if (this.completedLessonsEl) {
            this.completedLessonsEl.textContent = completedLessons;
        }

        // Average score across all completed quizzes
        const scoreValues = Object.values(this.scores);
        const avgScore = scoreValues.length > 0 ?
            Math.round(scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length) : 0;
        if (this.avgScoreEl) {
            this.avgScoreEl.textContent = avgScore;
        }

        // Header score (current/overall average)
        if (this.currentScoreEl) {
            this.currentScoreEl.textContent = avgScore;
        }

        // Mastered topics = lessons with confidence >= 80
        const mastered = Object.values(this.confidenceLevels).filter(c => c >= 80).length;
        if (this.masteredTopicsEl) {
            this.masteredTopicsEl.textContent = mastered;
        }
    }
    
    markLessonComplete(lessonId, score, weakConcepts = []) {
        if (!this.courseData) return;

        this.completedLessons.add(lessonId);
        this.scores[lessonId] = score;

        // Track weak areas
        weakConcepts.forEach(concept => {
            if (!this.weakAreas.includes(concept)) {
                this.weakAreas.push(concept);
            }
        });

        // Calculate confidence
        const confidence = this.calculateConfidence(score, weakConcepts.length);
        this.confidenceLevels[lessonId] = confidence;

        // Update UI
        this.updateNavigation();
        this.updateProgress();

        // Save progress
        this.saveProgress();

        // Log activity
        this.logActivity(`Completed lesson: ${lessonId} with score ${score}%`);

        // Trigger the completion modal if every lesson is now done
        const allLessons = this.getAllLessonIds();
        if (allLessons.length > 0 && allLessons.every(id => this.completedLessons.has(id))) {
            this.completeCourse();
        }
    }

    getAllLessonIds() {
        const ids = [];
        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
        levelOrder.forEach(levelKey => {
            const level = this.courseData.levels[levelKey];
            if (level && level.lessons) {
                ids.push(...Object.keys(level.lessons));
            }
        });
        return ids;
    }
    
    calculateConfidence(score, weakCount) {
        let confidence = score;
        if (weakCount > 2) {
            confidence -= weakCount * 5;
        }
        return Math.max(0, Math.min(100, confidence));
    }
    
    adaptiveLearning(weakConcepts) {
        if (weakConcepts.length === 0) {
            console.log('All concepts mastered!');
            return;
        }
        
        const reinforcementLessons = [];
        const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
        
        for (const levelKey of levelOrder) {
            const level = this.courseData.levels[levelKey];
            if (!level || !level.lessons) continue;
            
            for (const [lessonId, lesson] of Object.entries(level.lessons)) {
                if (lesson.concepts) {
                    const matchingConcepts = lesson.concepts.filter(c => weakConcepts.includes(c));
                    if (matchingConcepts.length > 0) {
                        reinforcementLessons.push({
                            lessonId,
                            lesson,
                            matchingConcepts,
                            level: levelKey
                        });
                    }
                }
            }
        }
        
        reinforcementLessons.sort((a, b) => b.matchingConcepts.length - a.matchingConcepts.length);
        
        if (reinforcementLessons.length > 0) {
            this.showReinforcementRecommendation(reinforcementLessons[0], weakConcepts);
        }
    }
    
    showReinforcementRecommendation(lessonData, weakConcepts) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--surface-color);
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            max-width: 400px;
            z-index: 10000;
            animation: slideUp 0.3s ease;
        `;
        
        container.innerHTML = `
            <h4 style="color: var(--ai-orange); margin-bottom: 1rem;">🎯 Reinforcement Recommended</h4>
            <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">
                Based on your quiz results, we recommend reviewing:
            </p>
            <div style="background: var(--surface-light); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
                <strong style="color: var(--ai-blue);">${lessonData.lesson.title}</strong>
                <p style="color: var(--text-muted); font-size: 0.75rem; margin: 0.25rem 0 0 0;">
                    Covers: ${lessonData.matchingConcepts.join(', ')}
                </p>
            </div>
            <button class="btn-primary" onclick="course.startReinforcementLesson('${lessonData.lessonId}')" 
                    style="width: 100%; font-size: 0.875rem; padding: 0.5rem;">
                Review Now
            </button>
            <button class="btn-secondary" onclick="this.remove()" 
                    style="width: 100%; font-size: 0.875rem; padding: 0.5rem; margin-top: 0.5rem;">
                Dismiss
            </button>
        `;
        
        document.body.appendChild(container);
        
        setTimeout(() => {
            if (container.parentNode) {
                container.remove();
            }
        }, 10000);
    }
    
    startReinforcementLesson(lessonId) {
        this.showLesson(lessonId);
        document.querySelectorAll('div[style*="position: fixed"]').forEach(el => {
            if (el.textContent.includes('Reinforcement Recommended')) {
                el.remove();
            }
        });
    }
    
    updateTime() {
        this.timeSpent += 1;
        
        if (this.confidenceLevelEl) {
            const totalConfidence = Object.values(this.confidenceLevels).reduce((sum, conf) => sum + conf, 0);
            const avgConfidence = Object.keys(this.confidenceLevels).length > 0 ? 
                Math.round(totalConfidence / Object.keys(this.confidenceLevels).length) : 0;
            this.confidenceLevelEl.textContent = avgConfidence;
        }
    }
    
    logActivity(action) {
        const timestamp = new Date().toISOString();
        this.activityLog.push({ timestamp, action });
        
        if (this.activityLog.length > 100) {
            this.activityLog.shift();
        }
        
        console.log(`[${timestamp}] ${action}`);
    }
    
    restartCourse() {
        this.completedLessons.clear();
        this.scores = {};
        this.weakAreas = [];
        this.timeSpent = 0;
        this.confidenceLevels = {};
        this.currentLessonId = null;

        this.saveProgress();
        location.reload();
    }
    
    completeCourse() {
        const totalLessons = Object.values(this.courseData.levels)
            .reduce((count, level) => count + Object.keys(level.lessons || {}).length, 0);
        
        const completedLessons = this.completedLessons.size;
        const progress = Math.round((completedLessons / totalLessons) * 100);
        
        const totalScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0);
        const avgScore = Object.keys(this.scores).length > 0 ? 
            Math.round(totalScore / Object.keys(this.scores).length) : 0;
        
        const hoursSpent = Math.floor(this.timeSpent / 3600);
        const minutesSpent = Math.floor((this.timeSpent % 3600) / 60);
        const totalTime = hoursSpent > 0 ? `${hoursSpent}h ${minutesSpent}m` : `${minutesSpent}m`;
        
        // Show completion modal
        const modal = document.getElementById('completionModal');
        const message = document.getElementById('completionMessage');
        const finalScore = document.getElementById('finalScore');
        const timeSpentEl = document.getElementById('timeSpent');
        const topicsMastered = document.getElementById('topicsMastered');
        const weakAreasList = document.getElementById('weakAreas');
        
        if (modal && message && finalScore && timeSpentEl && topicsMastered && weakAreasList) {
            if (progress >= 100) {
                message.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">
                    Congratulations! You've completed the entire Policy-Based Access Control course, foundations to capstones!<br>
                    You now have a comprehensive understanding of policy-based access control principles and enforcement.
                </p>`;
            } else if (progress >= 50) {
                message.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">
                    Great progress! You've completed ${progress}% of the course.<br>
                    Keep going to achieve full mastery of policy-based access control!
                </p>`;
            } else {
                message.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">
                    You've started your PBAC journey!<br>
                    With ${progress}% completion, you're building a solid foundation.
                </p>`;
            }
            
            finalScore.textContent = avgScore;
            timeSpentEl.textContent = totalTime;
            topicsMastered.textContent = Object.keys(this.confidenceLevels).length;
            
            weakAreasList.innerHTML = '';
            if (this.weakAreas.length > 0) {
                this.weakAreas.forEach(weak => {
                    const li = document.createElement('li');
                    li.textContent = weak;
                    weakAreasList.appendChild(li);
                });
            } else {
                weakAreasList.innerHTML = '<li style="color: var(--ai-green);">None! All concepts mastered!</li>';
            }
            
            modal.classList.add('show');
        }
    }
}

// Initialize course
window.course = new PBACourse();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.course;
}

// Fix for canvas rounded rect
if (CanvasRenderingContext2D.prototype.roundRect === undefined) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}
