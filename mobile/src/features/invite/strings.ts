// Translation values are preserved from the original screen dictionaries.
// @ts-nocheck
export const inviteStrings = {
  zh: {
    inviteBanner: (n) => `${n} 邀請你使用時光膠囊。登入後你們就會成為好友。`,
    inviteAccepted: (n) => `已和 ${n} 成為好友`,
    inviteBad: "這個邀請連結無效。",
    inviteFriend: "邀請好友",
    inviteShareTitle: "時光膠囊邀請",
    inviteShareText: (n) =>
    `${n} 邀請你使用時光膠囊，一起寄一封要等時間到了才能打開的信。`,
    linkCopied: "已複製邀請連結",
    inviteLinkH: "把這條連結傳給朋友",
    copy: "複製連結",
    share: "分享",
    "invite.title": "邀請好友",
    "invite.heading": "把這條連結傳給朋友",
    "invite.link": "邀請連結",
    "invite.shareTitle": "時光膠囊邀請",
    "invite.shareText": (n) => `${n} 邀請你使用時光膠囊，一起寄一封要等時間到了才能打開的信。`,
    "invite.copy": "複製連結",
    "invite.appLink": "在已安裝的 App 中打開",
    "invite.copyAppLink": "複製 App 連結",
    "invite.share": "分享",
    "invite.copied": "已複製邀請連結",
    "invite.error": "無法建立邀請連結，請再試一次。"
  },
  en: {
    inviteBanner: (n) =>
    `${n} invited you to Time Capsule. Sign in and you'll be friends.`,
    inviteAccepted: (n) => `You and ${n} are now friends`,
    inviteBad: "This invite link isn't valid.",
    inviteFriend: "Invite a friend",
    inviteShareTitle: "Time Capsule invite",
    inviteShareText: (n) =>
    `${n} invited you to Time Capsule, for letters that can only be opened when the time comes.`,
    linkCopied: "Invite link copied",
    inviteLinkH: "Send this link to a friend",
    copy: "Copy link",
    share: "Share",
    "invite.title": "Invite a friend",
    "invite.heading": "Send this link to a friend",
    "invite.link": "Invite link",
    "invite.shareTitle": "Time Capsule invite",
    "invite.shareText": (n) => `${n} invited you to Time Capsule, for letters that can only be opened when the time comes.`,
    "invite.copy": "Copy link",
    "invite.appLink": "Open in the installed app",
    "invite.copyAppLink": "Copy app link",
    "invite.share": "Share",
    "invite.copied": "Invite link copied",
    "invite.error": "Could not create an invite link. Please try again."
  },
} as const;
