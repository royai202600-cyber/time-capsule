// The points slider's scale (PointsSlider.tsx): 5–200 in steps of 5. The number box beside it takes 1–999.
export const SLIDER = { min: 5, max: 200, step: 5 } as const;

/** Where a value sits on the slider, from 0 to 1; anything past 200 rests at the end. */
export const sliderSpot = (value: number) =>
  Math.max(0, Math.min(1, (value - SLIDER.min) / (SLIDER.max - SLIDER.min)));
/** The value at a spot on the slider, snapped to its steps. */
export const sliderValue = (spot: number) =>
  SLIDER.min + Math.round(Math.max(0, Math.min(1, spot)) * (SLIDER.max - SLIDER.min) / SLIDER.step) * SLIDER.step;
