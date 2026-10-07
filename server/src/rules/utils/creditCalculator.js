/**
 * Credit & Period calculation utilities.
 */

export function calculateTheoryCredits(L = 0, T = 0, P = 0) {
  return Number(L) + Number(T) + (Number(P) / 2);
}

export function calculateLabCredits(P = 0) {
  return Number(P) / 2;
}

export function calculateRequiredPeriods(credits, periodsPerCredit = 12) {
  return Number(credits) * periodsPerCredit;
}

export function calculateTcpPeriods(L = 0, T = 0, P = 0, periodsPerCredit = 12) {
  return {
    theoryPeriods: (Number(L) + Number(T)) * periodsPerCredit,
    practicalPeriods: Number(P) * periodsPerCredit,
    totalPeriods: (Number(L) + Number(T) + Number(P)) * periodsPerCredit
  };
}
