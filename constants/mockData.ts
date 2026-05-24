// PHASE 1 STEP 2
import type { Claim } from "../types/claim";

export const mockClaims: Claim[] = [
  {
    id: "claim-01",
    title: "New study shows coffee boosts memory retention",
    description: "A recent survey indicates that daily coffee drinkers performed better on memory tasks.",
    sourceUrl: "https://example.com/coffee-memory",
    votesTrue: 128,
    votesFake: 26,
    votesUnsure: 14,
    status: "pending",
    createdAt: "2026-05-23T12:00:00Z",
    author: {
      id: "user-01",
      username: "newswatcher",
      avatar: "",
    },
  },
  {
    id: "claim-02",
    title: "City council approves new green transit program",
    description: "Officials say the program will improve sustainability and reduce commute emissions.",
    sourceUrl: "https://example.com/green-transit",
    votesTrue: 94,
    votesFake: 11,
    votesUnsure: 32,
    status: "true",
    createdAt: "2026-05-22T08:30:00Z",
    author: {
      id: "user-02",
      username: "factfinder",
      avatar: "",
    },
  },
  {
    id: "claim-03",
    title: "Tech startup claims wearable can detect stress instantly",
    description: "The startup says the device monitors physiological signals to spot stress in real time.",
    sourceUrl: "https://example.com/stress-wearable",
    votesTrue: 65,
    votesFake: 40,
    votesUnsure: 55,
    status: "unsure",
    createdAt: "2026-05-21T15:45:00Z",
    author: {
      id: "user-03",
      username: "verifynow",
      avatar: "",
    },
  },
];
