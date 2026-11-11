/**
 * Unit test specification for Firestore Security Rules (SiPiket OSIS)
 */
export const firestoreRulesTestCases = [
  {
    collection: 'members',
    description: 'Allows public read and authenticated valid member creation with immutable id',
  },
  {
    collection: 'schedules',
    description: 'Allows public read and authenticated valid schedule creation with mode enum and week cycle array',
  },
  {
    collection: 'swaps',
    description: 'Allows public read and authenticated valid temporary swap creation',
  },
  {
    collection: 'attendance',
    description: 'Allows public read and authenticated valid attendance record creation/update',
  },
];
