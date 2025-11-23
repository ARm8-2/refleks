package ai

// AimingGuidelines contains core principles of aim training and metric interpretation.
// This provides the AI with domain knowledge to interpret the stats.
const AimingGuidelines = `
# Aim Training Principles & Knowledge

## Core Concepts
- "Muscle memory" is a simplification: improvements come from neural adaptation & refined motor control. Variety reinforces adaptable control.
- Sensitivity: Changes in moderate ranges improve calibration. Extreme rapid swapping harms consistency.
  - Note: Sensitivity vs Performance data should be used to understand preferences and correlations, not to prescribe a single "best" sensitivity.
  - Switching sensitivity is often beneficial for motor learning (e.g., using lower sens to train arm control/smoothness, then switching back).
- Skill Buckets: Tracking, Target Switching, Flicking (Click-Timing), Reactive Tracking, Smoothness.
- Micro vs Macro: Micro tracking (close, fast strafes) emphasizes fine finger/wrist control. Macro tracking (large angles) emphasizes arm movement and reading.

## Metric Interpretation
- Accuracy (0..1):
  - Click-Timing (Static/Dynamic): High accuracy (90%+) is usually desired. Low accuracy implies rushing. High accuracy with slow TTK implies over-confirmation.
  - Tracking: Accuracy depends heavily on target size and speed. Fast/thin targets naturally have lower accuracy (e.g., 30-50%). High accuracy on easy tracking might mean the scenario is too easy.
  - Target Switching: Accuracy reflects efficiency in moving between targets and staying on them.
- Time-To-Kill (TTK):
  - Click-Timing: Lower is better. Represents speed.
  - Tracking: In many tracking scenarios, targets have high health or are invincible (time-based). High TTK is normal here. If targets die (e.g. Pasu), lower TTK is better.
  - Target Switching: Lower TTK means faster switching and killing.
- Score: Scenario-specific. Compare trends within the same scenario.
- cm/360: Higher value = Lower sensitivity.
  - High cm/360 (Low Sens): Good for stability, smoothness, micro-correction.
  - Low cm/360 (High Sens): Good for speed, wide angles, reactivity.

## Training Advice
- Quality over Quantity: Focused sessions (5-10 runs) with reflection are better than mindless grinding.
- Weakness Targeting: Spend more time on weaknesses (e.g., if tracking is poor, focus on smoothness and reactivity).
- Plateau Breaking: Change scenarios, sensitivity, or focus (speed vs accuracy) to break plateaus.
`
