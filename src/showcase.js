// Curated high-scoring Build Report cards for the workshop shelf.
// Grades pulled from the-build-report.vercel.app (Grades sort, All repos).
export const REPORT_URL = 'https://the-build-report.vercel.app/';

/** @typedef {{ id: string, name: string, section: 'holder'|'shipping', tag: string, econ: string, econLabel: string, builder: string, blurb: string, github: string }} ScoreBuild */

/** @type {ScoreBuild[]} */
export const SCORE_BUILDS = [
  {
    id: 'clawd-incinerator',
    name: 'clawd-incinerator',
    section: 'holder',
    tag: 'Direct burn',
    econ: 'A+',
    econLabel: 'Holder economics',
    builder: 'A',
    blurb: 'Quiet now because the community voted to stop topping it up — not because it failed. Clean burn design that bowed out when its job was done.',
    github: 'https://github.com/clawdbotatg/clawd-incinerator',
  },
  {
    id: 'receiver-buy-and-burn',
    name: 'receiver-buy-and-burn',
    section: 'holder',
    tag: 'Direct burn',
    econ: 'A+',
    econLabel: 'Holder economics',
    builder: 'A+',
    blurb: 'Permissionless receiver: takes USDC/ETH/CLAWD, swaps to CLAWD, burns to dead. Live on Base and Ethereum.',
    github: 'https://github.com/clawdbotatg/receiver-buy-and-burn',
  },
  {
    id: 'clawd-intern',
    name: 'clawd-intern',
    section: 'holder',
    tag: 'Supply lock',
    econ: 'A+',
    econLabel: 'Holder economics',
    builder: 'A',
    blurb: 'On-chain hiring tool that locks CLAWD to pay an intern over a rotating term — pay tied to how CLAWD does.',
    github: 'https://github.com/clawdbotatg/clawd-intern',
  },
  {
    id: 'clawd-fomo3d-v2',
    name: 'clawd-fomo3d-v2',
    section: 'holder',
    tag: 'Direct burn',
    econ: 'A+',
    econLabel: 'Holder economics',
    builder: 'A-',
    blurb: 'Game people actually played — 38+ rounds, $18k+ paid out. Every buy-in burns a slice of CLAWD automatically.',
    github: 'https://github.com/clawdbotatg/clawd-fomo3d-v2',
  },
  {
    id: 'clawd-twitter-proxy',
    name: 'clawd-twitter-proxy',
    section: 'shipping',
    tag: 'Indirect',
    econ: 'A+',
    econLabel: 'Shipping leverage',
    builder: 'A',
    blurb: 'Holders spend governance points to post on the main account via a Dutch auction — real utility for locked-token points.',
    github: 'https://github.com/clawdbotatg/clawd-twitter-proxy',
  },
  {
    id: 'clawd-containers',
    name: 'clawd-containers',
    section: 'shipping',
    tag: 'Infrastructure',
    econ: 'A+',
    econLabel: 'Shipping leverage',
    builder: 'B',
    blurb: 'Engine room for the worker fleet. If this stops, Leftclaw jobs — and the burns they fund — stop with it.',
    github: 'https://github.com/clawdbotatg/clawd-containers',
  },
];

export function scoreBuild(id) {
  return SCORE_BUILDS.find(b => b.id === id) || null;
}
