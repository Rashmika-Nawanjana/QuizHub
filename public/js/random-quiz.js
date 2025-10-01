document.addEventListener('DOMContentLoaded', function() {
    const moduleSelect = document.getElementById('moduleSelect');
    const quizSelect = document.getElementById('quizSelect');
    const numQuestionsInput = document.getElementById('numQuestions');

    // Populate quizzes based on selected module
    moduleSelect.addEventListener('change', function() {
        const module = moduleSelect.value;
        quizSelect.innerHTML = '<option value="">-- Select Quiz --</option>';
        numQuestionsInput.value = '';
        numQuestionsInput.max = '';
        if (!module) return;
        fetch(`/api/modules-quizzes?module=${module}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data.quizzes)) {
                    data.quizzes.forEach(q => {
                        const opt = document.createElement('option');
                        opt.value = q.id;
                        opt.textContent = q.name;
                        quizSelect.appendChild(opt);
                    });
                }
            });
    });

    // Set max number of questions based on selected quiz
    quizSelect.addEventListener('change', function() {
        const module = moduleSelect.value;
        const quizId = quizSelect.value;
        numQuestionsInput.value = '';
        numQuestionsInput.max = '';
        if (!module || !quizId) return;
        fetch(`/api/modules-quizzes?module=${module}&quizId=${quizId}`)
            .then(res => res.json())
            .then(data => {
                if (typeof data.totalQuestions === 'number') {
                    numQuestionsInput.max = data.totalQuestions;
                    numQuestionsInput.placeholder = `Max: ${data.totalQuestions}`;
                }
            });
    });

    // Validate number of questions
    numQuestionsInput.addEventListener('input', function() {
        const max = parseInt(numQuestionsInput.max, 10);
        if (numQuestionsInput.value > max) {
            numQuestionsInput.value = max;
        }
    });
});
