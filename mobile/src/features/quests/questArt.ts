// What a quest pin shows (docs/design/hunt-loop.md, "The map has two kinds of thing"): the same faceted pin
// everywhere, its picture saying what the quest does and its colour who made it (blue us, brass a person,
// plum once done). Older private-hunt kinds borrow the picture of the type they became.
import { questPinFrames, questTypePictures } from "../../art/manifest";
import type { PrivateHuntQuestType } from "../../services/questTypes";
import type { QuestKind } from "../../services/quests";
import { assetUri } from "../journey/live/types";
import { HUNT_QUESTS } from "../../services/cityHuntQuests";

export type AnyQuestType = QuestKind | PrivateHuntQuestType;
/** spin became Arrive, puzzle became Question, restore became Catch. */
export const questKindOf = (type: AnyQuestType): QuestKind =>
  type === "spin" ? "arrive" : type === "puzzle" ? "question" : type === "restore" ? "catch" : type;

export const questPicture = (type: AnyQuestType) => questTypePictures[questKindOf(type)];
/** The pin's picture and frame as URLs the map page can load. */
export const questPinArt = (type: AnyQuestType, color: "blue" | "brass", done: boolean) => ({
  photo: assetUri(questPicture(type)),
  frame: assetUri(questPinFrames[done ? "plum" : color]),
});

/** The faceted pins ship with the quest-pin release (HL-C3 applied); until then production keeps the photo teardrop. */
export const QUEST_PIN_ART = HUNT_QUESTS;
/** A quest pin's picture and frame, or its older photo face while the new pins are off. */
export const questPinFace = (type: AnyQuestType, color: "blue" | "brass", done: boolean, photo: string | null) =>
  QUEST_PIN_ART ? questPinArt(type, color, done) : { photo, frame: null };
