import { voiceStrings } from "../features/voice/strings";
import { sharedStrings } from "../features/shared/strings";
import { shopStrings } from "../features/shop/strings";
import { friendsStrings } from "../features/friends/strings";
import { meStrings } from "../features/me/strings";
import { authStrings } from "../features/auth/strings";
import { inviteStrings } from "../features/invite/strings";
import { cabinetStrings } from "../features/cabinet/strings";
import { profileStrings } from "../features/profile/strings";
import { journeyStrings } from "../features/journey/strings";
import { createStrings } from "../features/create/strings";
import { homeStrings } from "../features/home/strings";
import { capsuleStrings } from "../features/capsule/strings";

export const featureStrings = { voice: voiceStrings, shared: sharedStrings, shop: shopStrings, friends: friendsStrings, me: meStrings, auth: authStrings, invite: inviteStrings, cabinet: cabinetStrings, profile: profileStrings, journey: journeyStrings, create: createStrings, home: homeStrings, capsule: capsuleStrings };
export const strings = {
  zh: { ...voiceStrings.zh, ...sharedStrings.zh, ...shopStrings.zh, ...friendsStrings.zh, ...meStrings.zh, ...authStrings.zh, ...inviteStrings.zh, ...cabinetStrings.zh, ...profileStrings.zh, ...journeyStrings.zh, ...createStrings.zh, ...homeStrings.zh, ...capsuleStrings.zh },
  en: { ...voiceStrings.en, ...sharedStrings.en, ...shopStrings.en, ...friendsStrings.en, ...meStrings.en, ...authStrings.en, ...inviteStrings.en, ...cabinetStrings.en, ...profileStrings.en, ...journeyStrings.en, ...createStrings.en, ...homeStrings.en, ...capsuleStrings.en },
};
