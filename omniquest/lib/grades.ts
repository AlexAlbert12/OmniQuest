export function scoreToGrade(score: number, maxPossibleScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxPossibleScore) || maxPossibleScore <= 0) {
    return 0;
  }

  return roundGrade((Math.max(0, score) / maxPossibleScore) * 10);
}

export function answersToAccuracyPercent(correctAnswers: number, totalAnswers: number) {
  if (!Number.isFinite(correctAnswers) || !Number.isFinite(totalAnswers) || totalAnswers <= 0) {
    return 0;
  }

  return Math.round((Math.max(0, correctAnswers) / totalAnswers) * 100);
}

export function accuracyToGrade(accuracyPercent: number) {
  if (!Number.isFinite(accuracyPercent)) {
    return 0;
  }

  return roundGrade(Math.max(0, accuracyPercent) / 10);
}

export function answersToGrade(correctAnswers: number, totalAnswers: number) {
  return accuracyToGrade(answersToAccuracyPercent(correctAnswers, totalAnswers));
}

function roundGrade(value: number) {
  return Math.min(10, Math.max(0, Number(value.toFixed(1))));
}
