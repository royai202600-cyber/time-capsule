/** Quest tasks shared by City Hunts and private hunts. Wire values preserve saved hunt progress. */
export const QUEST_TYPES = ['checkin', 'arrive', 'qr', 'spin', 'puzzle', 'restore', 'landmark', 'return'] as const;
export type QuestType = typeof QUEST_TYPES[number];
export type CityHuntQuestType = Extract<QuestType, 'checkin' | 'spin' | 'restore' | 'landmark' | 'return'>;
export type PrivateHuntQuestType = Extract<QuestType, 'arrive' | 'spin' | 'puzzle'>;
