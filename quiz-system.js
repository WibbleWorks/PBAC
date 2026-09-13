// PBAC Training Course - Quiz System
// ====================================================

class QuizSystem {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.quizContainer = null;
        this.quizDisplay = null;
        this.weakConcepts = [];
        this.correctCount = 0;
        this.timeLeft = 0;
        this.timer = null;
        this.startTime = null;
        this.timeLimit = 0;
        this._lastQuiz = null; // snapshot for restart after endQuiz clears state

        // T5.7 - shuffle maps: question display order -> original index,
        // and per-question: option display index -> original option index.
        // This lets us keep weakConcept/correct tracking stable across restarts
        // while preventing memorization by position.
        this.questionOrder = [];
        this.optionOrder = []; // array of maps, indexed by display position

        this.init();
    }

    init() {
        this.quizContainer = document.getElementById('quizContainer');
    }

    // Fisher-Yates shuffle. Returns a new array.
    _shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Cancel any in-progress quiz (used when switching lessons).
    // Resets ALL quiz state: activeCount/_lastScore/score/weakConcepts would
    // otherwise leak a previous lesson's sampled review into a cleared panel.
    cancelQuiz() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this._lastQuiz = null;
        this._lastScore = null;
        this.questionOrder = [];
        this.optionOrder = [];
        this.activeCount = null;
        this.score = 0;
        this.weakConcepts = [];
        this.correctCount = 0;
        this.timeLeft = 0;
        this.startTime = null;
        this.timeLimit = 0;
        if (this.quizContainer) {
            this.quizContainer.innerHTML = '';
            this.quizContainer.classList.remove('show');
        }
    }

    startQuiz(quiz) {
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            console.error('Cannot start quiz: missing questions', quiz);
            return;
        }

        // Clear any previous timer/quiz
        this.cancelQuiz();

        this.currentQuiz = quiz;
        this._lastQuiz = quiz;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.weakConcepts = [];
        this.correctCount = 0;
        this.timeLeft = quiz.timeLimit || 300;
        this.timeLimit = quiz.timeLimit || 300;

        // T-bank - Sample a subset when the quiz carries a bank larger than
        // sampleSize (course convention: bank of 8, sampled quiz of 5, so
        // memorization by position/order fails and passingScore math stays
        // on the 0/20/40/60/80/100 ladder of 5 questions).
        const n = quiz.questions.length;
        const sampleN = (quiz.sampleSize && quiz.sampleSize > 0 && quiz.sampleSize < n)
            ? quiz.sampleSize : n;
        this.activeCount = sampleN;
        this.questionOrder = this._shuffle([...Array(n).keys()]).slice(0, sampleN);
        this.optionOrder = this.questionOrder.map(origIdx => {
            const q = quiz.questions[origIdx];
            const opts = q.options;
            return this._shuffle([...Array(opts.length).keys()]);
        });
        // userAnswers[i] holds the DISPLAY index the user picked (or null);
        // we map back to original option via optionOrder at scoring time.
        // Sized to the SAMPLED count, not the bank.
        this.userAnswers = new Array(sampleN).fill(null);

        // Start timer
        this.startTime = Date.now();
        this.updateTimer();
        this.timer = setInterval(() => this.updateTimer(), 1000);

        // Show quiz in panel
        if (this.quizContainer) {
            this.quizContainer.innerHTML = this.getQuizHTML();
            this.quizContainer.classList.add('show');
            // Now display the first question with proper event listeners
            this.displayQuestion();
        }

        console.log(`Started quiz: ${quiz.title} (shuffled)`);
    }

    // Resolve the original question given the current (shuffled) display position
    _origQuestion(displayIdx) {
        const origIdx = this.questionOrder[displayIdx];
        return this.currentQuiz.questions[origIdx];
    }

    // Resolve the original option object the user picked, given (displayIdx, pickedDisplayIdx)
    _origOption(displayIdx, pickedDisplayIdx) {
        const q = this._origQuestion(displayIdx);
        const optionMap = this.optionOrder[displayIdx];
        const origOptionIdx = optionMap[pickedDisplayIdx];
        return q.options[origOptionIdx];
    }

    updateTimer() {
        if (!this.currentQuiz) return;

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.timeLeft = Math.max(0, this.timeLimit - elapsed);

        const timerDisplay = document.getElementById('quizTimer');
        if (timerDisplay) {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (this.timeLeft <= 0) {
            this.endQuiz();
        }
    }

    displayQuestion() {
        if (!this.currentQuiz) return;

        const question = this._origQuestion(this.currentQuestionIndex);
        const questionElement = document.getElementById('quizQuestion');
        const optionsElement = document.getElementById('quizOptions');
        const progressElement = document.getElementById('quizProgress');
        const timerElement = document.getElementById('quizTimer');

        if (questionElement && optionsElement) {
            // Update question (use the shuffled question for this slot)
            questionElement.innerHTML = `
                <h3>${question.question}</h3>
                ${question.type === 'multiple-choice' ? '' : ''}
            `;

            // Update progress
            if (progressElement) {
                progressElement.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.activeCount || this.currentQuiz.questions.length}`;
            }

            // Update timer
            if (timerElement) {
                const minutes = Math.floor(this.timeLeft / 60);
                const seconds = this.timeLeft % 60;
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            // Update navigation buttons
            this.updateNavigation();

            // Add click handlers (this will rebuild the options HTML and add event listeners)
            this.addOptionHandlers();
        }
    }

    addOptionHandlers() {
        // Remove existing event listeners by recreating the HTML
        const optionsContainer = document.getElementById('quizOptions');
        if (!optionsContainer) return;

        const currentQIndex = this.currentQuestionIndex;
        const question = this._origQuestion(currentQIndex);
        const optionMap = this.optionOrder[currentQIndex];

        // Rebuild the options HTML from the SHUFFLED display order
        let optionsHTML = '';
        optionMap.forEach((origOptionIdx, displayIdx) => {
            const option = question.options[origOptionIdx];
            const letter = String.fromCharCode(65 + displayIdx);
            const isSelected = this.userAnswers[currentQIndex] === displayIdx;
            const isAnswered = this.userAnswers[currentQIndex] !== null;

            let classes = 'quiz-option';
            if (isAnswered) {
                if (isSelected) {
                    classes += ' selected';
                    if (option.isCorrect) {
                        classes += ' correct';
                    } else {
                        classes += ' incorrect';
                    }
                } else if (option.isCorrect) {
                    // This is the correct answer but not selected
                    classes += ' correct-unselected';
                }
            } else if (isSelected) {
                classes += ' selected';
            }

            optionsHTML += `
                <div class="${classes}" data-index="${displayIdx}" data-question="${currentQIndex}" role="button" tabindex="0" aria-label="Option ${letter}: ${option.text}">
                    <span class="option-letter">${letter}</span>
                    <span class="quiz-option-label">${option.text}</span>
                </div>
            `;
        });

        // Replace the entire options container HTML
        optionsContainer.innerHTML = optionsHTML;

        // Now add event listeners to the new options
        const newOptions = optionsContainer.querySelectorAll('.quiz-option');
        const quizSystem = this;

        newOptions.forEach(option => {
            const handleSelect = function(e) {
                // Allow keyboard activation (Enter / Space) and mouse click
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                if (e.type === 'keydown') e.preventDefault();

                if (quizSystem.userAnswers[currentQIndex] !== null) return;

                // displayIdx = the SHUFFLED position the user clicked. We store
                // this and map back to the original option via optionOrder at scoring time.
                const displayIdx = parseInt(this.dataset.index, 10);
                quizSystem.userAnswers[currentQIndex] = displayIdx;

                // Track weak concept if the picked (original) option is incorrect
                const q = quizSystem._origQuestion(currentQIndex);
                const origOpt = q.options[quizSystem.optionOrder[currentQIndex][displayIdx]];
                if (!origOpt.isCorrect) {
                    if (q.concept && !quizSystem.weakConcepts.includes(q.concept)) {
                        quizSystem.weakConcepts.push(q.concept);
                    }
                }

                // Re-render options to show selected/correct/incorrect states
                quizSystem.addOptionHandlers();
            };
            option.addEventListener('click', handleSelect);
            option.addEventListener('keydown', handleSelect);
        });
    }

    updateNavigation() {
        if (!this.currentQuiz) return;
        const n = this.activeCount || this.currentQuiz.questions.length;
        const prevBtn = document.getElementById('quizPrev');
        const nextBtn = document.getElementById('quizNext');
        const submitBtn = document.getElementById('quizSubmit');

        if (prevBtn) {
            prevBtn.style.display = this.currentQuestionIndex > 0 ? 'inline-flex' : 'none';
        }

        if (nextBtn && submitBtn) {
            if (this.currentQuestionIndex < n - 1) {
                nextBtn.style.display = 'inline-flex';
                submitBtn.style.display = 'none';
            } else {
                nextBtn.style.display = 'none';
                submitBtn.style.display = 'inline-flex';
            }
        }
    }

    nextQuestion() {
        if (!this.currentQuiz) return;
        const n = this.activeCount || this.currentQuiz.questions.length;
        if (this.currentQuestionIndex < n - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    prevQuestion() {
        if (!this.currentQuiz) return;
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
        }
    }

    endQuiz() {
        // Clear timer
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // Deduplicate weak concepts (single source of truth is the click handler)
        const weakConcepts = [...new Set(this.weakConcepts)];

        // Map DISPLAY-position answers back to ORIGINAL option indices to score
        // against the canonical quiz.
        let correctCount = 0;
        const numQuestions = this.activeCount || this.currentQuiz.questions.length;
        const userOriginalAnswers = [];
        this.userAnswers.forEach((displayAns, displayQIdx) => {
            if (displayAns === null) {
                userOriginalAnswers.push(null);
                const origQuestionIdx = this.questionOrder[displayQIdx];
                const q = this.currentQuiz.questions[origQuestionIdx];
                if (q.concept && !weakConcepts.includes(q.concept)) {
                    weakConcepts.push(q.concept);
                }
                return;
            }
            const origQuestionIdx = this.questionOrder[displayQIdx];
            const origOptionIdx = this.optionOrder[displayQIdx][displayAns];
            const q = this.currentQuiz.questions[origQuestionIdx];
            const option = q.options[origOptionIdx];
            userOriginalAnswers.push({ origQuestionIdx, origOptionIdx, correct: !!(option && option.isCorrect) });
            if (option && option.isCorrect) correctCount++;
        });

        const finalScore = Math.round((correctCount / numQuestions) * 100);
        const totalQuestions = numQuestions;
        const correct = correctCount;
        const incorrect = totalQuestions - correct;

        this.correctCount = correct;
        this.score = finalScore;
        this.weakConcepts = weakConcepts;
        // Save score-state for review mode (T5.8) so reviewers can re-display
        // every question with the user's pick + the correct answer + explanation.
        this._lastScore = {
            quiz: this._lastQuiz,
            questionOrder: this.questionOrder.slice(),
            optionOrder: this.optionOrder.map(m => m.slice()),
            userAnswers: this.userAnswers.slice(),
            userOriginalAnswers,
            score: finalScore,
            correct,
            incorrect,
            weakConcepts
        };

        const quizSnapshot = this._lastQuiz;

        // Show results
        if (this.quizContainer) {
            this.quizContainer.innerHTML = this.getResultsHTML(finalScore, correct, incorrect, quizSnapshot, numQuestions);
        }

        // Notify course system
        if (window.course) {
            const currentLessonId = window.course.currentLessonId;
            if (currentLessonId) {
                window.course.markLessonComplete(currentLessonId, finalScore, this.weakConcepts);
                window.course.adaptiveLearning(this.weakConcepts);
            }
        }

        // Reset state but keep _lastQuiz + _lastScore so restart / review work.
        // activeCount is only valid while currentQuiz != null (cancelQuiz nulls
        // both; guards below re-check currentQuiz first).
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];

        console.log(`Quiz completed. Score: ${finalScore}%, Weak concepts: ${this.weakConcepts.join(', ')}`);
    }

    // T5.8 - Review mode: render every question with the user's pick, the
    // correct answer, and the per-question explanation. Reuses _lastScore.
    showReview() {
        const last = this._lastScore;
        if (!last || !last.quiz) {
            if (this.quizContainer) this.quizContainer.innerHTML = '<p>No quiz to review yet. Take a quiz first.</p>';
            return;
        }
        const q = last.quiz;
        let html = `<div class="quiz-results"><h3>📋 Review: ${q.title}</h3>`;
        last.questionOrder.forEach((origQIdx, displayQIdx) => {
            const question = q.questions[origQIdx];
            const optMap = last.optionOrder[displayQIdx];
            const displayAns = last.userAnswers[displayQIdx];
            const origOptIdx = displayAns === null ? null : optMap[displayAns];
            const correctOrigIdx = question.options.findIndex(o => o.isCorrect);

            html += `<div style="margin: 1rem 0; padding: 0.75rem; background: var(--surface-light); border-radius: 6px;">`;
            html += `<p style="font-weight:600;">Q${displayQIdx + 1}. ${question.question}</p>`;
            optMap.forEach((origOptIdx2, dIdx) => {
                const opt = question.options[origOptIdx2];
                const letter = String.fromCharCode(65 + dIdx);
                let cls = 'quiz-option';
                let marker = '';
                if (origOptIdx2 === correctOrigIdx) { cls += ' correct'; marker = ' ✓ correct'; }
                if (origOptIdx === origOptIdx2 && opt.isCorrect) { /* already correct */ }
                else if (origOptIdx === origOptIdx2 && !opt.isCorrect) { cls += ' incorrect'; marker = ' ✗ your answer'; }
                else if (displayAns === null && origOptIdx2 === correctOrigIdx) { /* correct NOT selected */ }
                html += `<div class="${cls}" style="cursor:default;"><span class="option-letter">${letter}</span><span class="quiz-option-label">${opt.text}${marker}</span></div>`;
            });
            if (displayAns === null) {
                html += `<p style="color: var(--ai-red); font-size: 0.8rem;">You skipped this question.</p>`;
            }
            if (question.explanation) {
                html += `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top:0.5rem;"><strong>Explanation:</strong> ${question.explanation}</p>`;
            }
            html += `</div>`;
        });
        html += `<button class="btn-secondary" onclick="quiz.closeReview()" style="margin-top:1rem;width:100%;">Back to results</button>`;
        html += `</div>`;
        if (this.quizContainer) this.quizContainer.innerHTML = html;
    }

    closeReview() {
        // Re-render the results screen from _lastScore
        const last = this._lastScore;
        if (!last || !last.quiz) return;
        if (this.quizContainer) {
            this.quizContainer.innerHTML = this.getResultsHTML(last.score, last.correct, last.incorrect, last.quiz, last.questionOrder.length);
        }
    }

    getQuizHTML() {
        if (!this.currentQuiz) return '';

        // First paint uses the first SAMPLED question (displayQuestion() takes
        // over immediately after, via _origQuestion mapping). Options render
        // from optionOrder (shuffled display order) so there is no flash of
        // bank order and no click-window mis-score.
        const question = this._origQuestion(this.currentQuestionIndex);
        const optMap = this.optionOrder[this.currentQuestionIndex] || question.options.map((_, i) => i);
        const total = this.activeCount || this.currentQuiz.questions.length;

        return `
            <div class="quiz-display">
                <div class="quiz-header">
                    <div>
                        <div class="quiz-title">${this.currentQuiz.title}</div>
                        <div class="quiz-info">
                            <span id="quizProgress">Question 1 of ${total}</span>
                            <span>Passing: ${this.currentQuiz.passingScore}%</span>
                            <span>Time: <span id="quizTimer">${Math.floor(this.timeLeft/60)}:${(this.timeLeft%60).toString().padStart(2,'0')}</span></span>
                        </div>
                    </div>
                </div>

                <div class="quiz-question" id="quizQuestion">
                    <h3>${question.question}</h3>
                </div>

                <div class="quiz-options" id="quizOptions">
                    ${optMap.map((origIdx, displayIdx) => {
                        const option = question.options[origIdx];
                        const letter = String.fromCharCode(65 + displayIdx);
                        return `
                            <div class="quiz-option" data-index="${displayIdx}" data-question="${this.currentQuestionIndex}" role="button" tabindex="0" aria-label="Option ${letter}: ${option.text}">
                                <span class="option-letter">${letter}</span>
                                <span class="quiz-option-label">${option.text}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="quiz-navigation">
                    <button class="btn-secondary" id="quizPrev" onclick="quiz.prevQuestion()">← Previous</button>
                    <div style="flex: 1;"></div>
                    <button class="btn-secondary" id="quizNext" onclick="quiz.nextQuestion()">Next →</button>
                    <button class="btn-primary" id="quizSubmit" onclick="quiz.endQuiz()" style="display: none;">Submit Quiz</button>
                </div>
            </div>
        `;
    }

    getResultsHTML(score, correct, incorrect, quiz, totalOverride) {
        // Use the passed-in quiz snapshot if available (endQuiz nulls this.currentQuiz)
        const q = quiz || this.currentQuiz;
        if (!q) return '<div class="quiz-results"><p>Quiz session ended.</p></div>';

        const passed = score >= q.passingScore;
        // totalOverride carries the SAMPLED count (bank may be larger).
        const total = totalOverride || q.questions.length;

        let feedback = '';
        if (score >= 90) {
            feedback = `🌟 Excellent work! You've mastered this topic.`;
        } else if (score >= 75) {
            feedback = `👍 Good job! You have a solid understanding.`;
        } else if (score >= q.passingScore) {
            feedback = `✅ You passed! Consider reviewing the weak areas below.`;
        } else {
            feedback = `🔄 Keep practicing! Review the concepts and try again.`;
        }

        const weakList = this.weakConcepts.length > 0 ?
            `<div class="weak-areas">
                <h4>📋 Areas to Review:</h4>
                <ul>${this.weakConcepts.map(c => `<li>${c}</li>`).join('')}</ul>
             </div>` : '';

        return `
            <div class="quiz-results">
                <div class="quiz-score" style="color: ${passed ? 'var(--ai-green)' : 'var(--ai-red)'};">${score}%</div>
                <div class="quiz-feedback">
                    <strong>${feedback}</strong><br>
                    ${correct} of ${total} correct
                </div>
                ${weakList}
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn-primary" onclick="quiz.restartQuiz()" style="flex: 1;">
                        ${passed ? 'Continue' : 'Try Again'}
                    </button>
                    <button class="btn-secondary" onclick="quiz.showReview()" style="flex: 1;" aria-label="Review every question with explanations">
                        📋 Review answers
                    </button>
                </div>
            </div>
        `;
    }

    // Restart the most recent quiz from the snapshot kept in _lastQuiz
    restartQuiz() {
        if (this._lastQuiz) {
            this.startQuiz(this._lastQuiz);
        } else if (this.currentQuiz) {
            this.startQuiz(this.currentQuiz);
        } else {
            console.warn('No quiz to restart');
            if (this.quizContainer) {
                this.quizContainer.innerHTML = '<p>No quiz available to restart.</p>';
            }
        }
    }
}

// Initialize quiz system
window.quiz = new QuizSystem();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizSystem;
}
