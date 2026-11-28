// The display's stage: everything is laid out on it in stage px, then it is
// scaled to fit the screen (home.js). A TV or laptop gets the 1920×1080
// stage. A phone held upright gets a tall one, 720 wide in the screen's own
// shape, so the Map, the Cloud and the lanterns fill the phone instead of
// being a strip across its middle.

const vw = document.documentElement.clientWidth || window.innerWidth || 1920;
const vh = document.documentElement.clientHeight || window.innerHeight || 1080;

export const PORTRAIT = vh > vw * 1.2;
export const STAGE = PORTRAIT
  ? { w: 720, h: Math.round(Math.min(1700, Math.max(960, (720 * vh) / vw))) }
  : { w: 1920, h: 1080 };

/** Would the screen want the other layout now (it was turned)? */
export const flipped = () => {
  const w = document.documentElement.clientWidth || window.innerWidth;
  const h = document.documentElement.clientHeight || window.innerHeight;
  return (h > w * 1.2) !== PORTRAIT;
};
