/**
 * FSRS-5 (Free Spaced Repetition Scheduler) implementation.
 *
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

// Card states
export enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

// Rating values
export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface FSRSCard {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  lastReviewAt: Date | null;
}

export interface SchedulingResult {
  card: FSRSCard;
  nextReviewAt: Date;
}

// Default FSRS-5 parameters (w0..w18)
const DEFAULT_WEIGHTS: number[] = [
  0.4072, // w0: initial stability for Again
  1.1829, // w1: initial stability for Hard
  3.1262, // w2: initial stability for Good
  15.4722, // w3: initial stability for Easy
  7.2102, // w4: difficulty weight
  0.5316, // w5: difficulty weight
  1.0651, // w6: stability decay
  0.0046, // w7: stability factor
  1.5418, // w8: hard factor
  0.1718, // w9: easy factor
  1.0252, // w10: hard penalty
  1.9661, // w11: easy bonus
  0.0446, // w12: short-term stability recovery
  0.3425, // w13: short-term difficulty weight
  0.1286, // w14: stability recovery after lapse
  2.1891, // w15: stability recovery after lapse (difficulty factor)
  0.008,  // w16: stability recovery after lapse (stability factor)
  0.312,  // w17: stability recovery after lapse
  3.6784, // w18: difficulty ceiling
];

const REQUESTED_RETENTION = 0.9;
const DECAY = -0.5;
const FACTOR = 19 / 81; // (0.9^(1/DECAY) - 1)

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate retrievability (probability of recall) given elapsed days and stability.
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/**
 * Calculate initial difficulty from first rating.
 */
function initDifficulty(rating: Rating, w: number[] = DEFAULT_WEIGHTS): number {
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
}

/**
 * Calculate next difficulty after a review.
 */
function nextDifficulty(
  d: number,
  rating: Rating,
  w: number[] = DEFAULT_WEIGHTS,
): number {
  const delta = -(w[6] * (rating - 3));
  const newD = d + delta * (w[7] * (10 - d));
  // Mean reversion toward initial difficulty
  const d0 = initDifficulty(Rating.Good, w);
  return clamp(w[7] * d0 + (1 - w[7]) * newD, 1, 10);
}

/**
 * Calculate initial stability from first rating.
 */
function initStability(rating: Rating, w: number[] = DEFAULT_WEIGHTS): number {
  return Math.max(w[rating - 1], 0.1);
}

/**
 * Calculate next stability for a review card (state=Review).
 */
function nextRecallStability(
  s: number,
  d: number,
  r: number,
  rating: Rating,
  w: number[] = DEFAULT_WEIGHTS,
): number {
  const sRecall =
    s *
    (1 +
      Math.exp(w[8]) *
        (11 - d) *
        Math.pow(s, -w[9]) *
        (Math.exp((1 - r) * w[10]) - 1));

  if (rating === Rating.Hard) {
    return Math.min(sRecall * w[15], sRecall);
  }
  if (rating === Rating.Easy) {
    return sRecall * w[16];
  }
  return sRecall;
}

/**
 * Calculate stability after forgetting (lapse).
 */
function nextForgetStability(
  s: number,
  d: number,
  r: number,
  w: number[] = DEFAULT_WEIGHTS,
): number {
  return Math.max(
    w[11] *
      Math.pow(d, -w[12]) *
      (Math.pow(s + 1, w[13]) - 1) *
      Math.exp((1 - r) * w[14]),
    0.1,
  );
}

/**
 * Calculate the interval in days for a given stability and desired retention.
 */
function nextInterval(
  stability: number,
  retention: number = REQUESTED_RETENTION,
): number {
  const interval =
    (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

/**
 * Create a new (blank) FSRS card.
 */
export function createNewCard(): FSRSCard {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    lastReviewAt: null,
  };
}

/**
 * Main scheduling function. Takes a card and a rating, returns the updated card and next review date.
 */
export function schedule(
  card: FSRSCard,
  rating: Rating,
  now: Date = new Date(),
  w: number[] = DEFAULT_WEIGHTS,
): SchedulingResult {
  const elapsedDays =
    card.lastReviewAt
      ? Math.max(
          0,
          Math.round(
            (now.getTime() - card.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

  let newStability: number;
  let newDifficulty: number;
  let newState: State;
  let newLapses = card.lapses;
  let scheduledDays: number;

  if (card.state === State.New) {
    // First review of a new card
    newDifficulty = initDifficulty(rating, w);
    newStability = initStability(rating, w);

    if (rating === Rating.Again) {
      newState = State.Learning;
      scheduledDays = 0; // Review again same session (1 min conceptually)
    } else if (rating === Rating.Hard) {
      newState = State.Learning;
      scheduledDays = 1;
    } else if (rating === Rating.Good) {
      newState = State.Review;
      scheduledDays = nextInterval(newStability);
    } else {
      // Easy
      newState = State.Review;
      scheduledDays = nextInterval(newStability);
    }
  } else if (card.state === State.Learning || card.state === State.Relearning) {
    // Short-term learning step
    newDifficulty = nextDifficulty(card.difficulty, rating, w);
    newStability = initStability(rating, w); // Reset stability for learning steps

    if (rating === Rating.Again) {
      newState = card.state; // Stay in Learning/Relearning
      scheduledDays = 0;
    } else if (rating === Rating.Hard) {
      newState = card.state;
      scheduledDays = 1;
    } else {
      // Good or Easy → graduate to Review
      newState = State.Review;
      newStability =
        card.state === State.Relearning
          ? nextForgetStability(card.stability || 0.1, newDifficulty, 0, w)
          : initStability(rating, w);
      scheduledDays = nextInterval(newStability);
    }
  } else {
    // State.Review
    const r = retrievability(elapsedDays, card.stability);
    newDifficulty = nextDifficulty(card.difficulty, rating, w);

    if (rating === Rating.Again) {
      // Lapse: card goes to Relearning
      newStability = nextForgetStability(card.stability, newDifficulty, r, w);
      newState = State.Relearning;
      newLapses = card.lapses + 1;
      scheduledDays = 0;
    } else {
      // Hard, Good, or Easy: stay in Review with updated stability
      newStability = nextRecallStability(
        card.stability,
        newDifficulty,
        r,
        rating,
        w,
      );
      newState = State.Review;
      scheduledDays = nextInterval(newStability);
    }
  }

  const nextReviewAt = new Date(now);
  if (scheduledDays === 0) {
    // Learning step: review in 10 minutes
    nextReviewAt.setMinutes(nextReviewAt.getMinutes() + 10);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + scheduledDays);
  }

  return {
    card: {
      stability: newStability,
      difficulty: newDifficulty,
      elapsedDays,
      scheduledDays,
      reps: card.reps + 1,
      lapses: newLapses,
      state: newState,
      lastReviewAt: now,
    },
    nextReviewAt,
  };
}

/**
 * Map a simple boolean (correct/incorrect) to an FSRS rating.
 */
export function booleanToRating(wasCorrect: boolean): Rating {
  return wasCorrect ? Rating.Good : Rating.Again;
}
