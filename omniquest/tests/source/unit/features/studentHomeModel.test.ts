import { buildStudentHomeViewModel } from '../../../../features/student-home/model'
import type { StudentHomeDashboardPayload } from '../../../../features/student-home/types'

function createPayload(overrides: Partial<StudentHomeDashboardPayload> = {}): StudentHomeDashboardPayload {
  return {
    currentUserId: 'current-student',
    profile: {
      id: 'current-student',
      alias: 'Dariucu',
      avatar: null,
      points: 0,
      role_id: 'student',
      visibility: 'public',
    },
    subjects: [],
    progressSummary: {
      subjects: [],
      totalClasses: 0,
      completedClasses: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      totalAttempts: 0,
      evaluatedAttempts: 0,
      pendingReviewAttempts: 0,
      correctAttempts: 0,
      accuracyPercent: 0,
      overallPercent: 0,
    },
    ranking: [],
    todayAttemptCount: 0,
    weeklyAttemptCount: 0,
    streakDays: 0,
    ...overrides,
  }
}

describe('student home ranking model', () => {
  test('does not communicate a ranking position before the student has started', () => {
    const viewModel = buildStudentHomeViewModel(createPayload({
      ranking: [
        { id: 'leader', alias: 'Líder', avatar: null, points: 250 },
      ],
    }))

    expect(viewModel.rankingSummary).toBeNull()
    expect(viewModel.rankingPreview).toEqual([
      expect.objectContaining({ id: 'leader', position: 1, estimated: false }),
    ])
  })

  test('marks an actual top-three position and keeps the current student visible', () => {
    const ranking = [
      { id: 'leader', alias: 'Líder', avatar: null, points: 300 },
      { id: 'second', alias: 'Segundo', avatar: null, points: 200 },
      { id: 'current-student', alias: 'Dariucu', avatar: null, points: 100 },
    ]
    const viewModel = buildStudentHomeViewModel(createPayload({
      profile: { ...createPayload().profile, points: 100 },
      progressSummary: { ...createPayload().progressSummary, answeredQuestions: 1, totalAttempts: 1 },
      ranking,
    }))

    expect(viewModel.rankingSummary).toEqual(expect.objectContaining({ position: 3, estimated: false }))
    expect(viewModel.rankingPreview[2]).toEqual(expect.objectContaining({
      id: 'current-student',
      position: 3,
      estimated: false,
    }))
  })

  test('adds an explicitly estimated current-student row when the RPC top list omits it', () => {
    const ranking = [
      { id: 'leader', alias: 'Líder', avatar: null, points: 300 },
      { id: 'second', alias: 'Segundo', avatar: null, points: 200 },
      { id: 'third', alias: 'Tercero', avatar: null, points: 100 },
      { id: 'fourth', alias: 'Cuarto', avatar: null, points: 90 },
      { id: 'fifth', alias: 'Quinto', avatar: null, points: 80 },
    ]
    const viewModel = buildStudentHomeViewModel(createPayload({
      profile: { ...createPayload().profile, points: 100 },
      progressSummary: { ...createPayload().progressSummary, answeredQuestions: 1, totalAttempts: 1 },
      ranking,
    }))

    expect(viewModel.rankingSummary).toEqual(expect.objectContaining({ position: 3, estimated: true }))
    expect(viewModel.rankingPreview.map((row) => row.id)).toEqual(['leader', 'second', 'current-student'])
    expect(viewModel.rankingPreview[2]).toEqual(expect.objectContaining({ position: 3, estimated: true }))
  })
})
