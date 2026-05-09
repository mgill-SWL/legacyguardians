export type Preset = {
  key: string;
  label: string;
  text: string;
};

export const healthcareWishesPresets: Preset[] = [
  {
    key: "comfort_focus_terminal",
    label: "Comfort-focused if terminal/irreversible",
    text: "If I am terminally ill or in an irreversible condition with no reasonable prospect of recovery, I prefer comfort-focused care and do not want life-prolonging treatment.",
  },
  {
    key: "trial_then_comfort",
    label: "Short trial of treatment, then comfort",
    text: "If I am critically ill, I want a short trial of life-prolonging treatment, but if my condition is not improving and recovery is unlikely, I prefer comfort-focused care.",
  },
  {
    key: "max_treatment",
    label: "Maximum treatment unless clearly futile",
    text: "I generally want life-prolonging treatment unless my physicians determine it would be medically ineffective or clearly futile.",
  },
  {
    key: "custom",
    label: "Draft your own",
    text: "",
  },
];

export const burialWishesPresets: Preset[] = [
  {
    key: "cremation_scatter",
    label: "Cremation; scatter/keep ashes (details below)",
    text: "I prefer cremation. Please handle my ashes as follows: ",
  },
  {
    key: "burial_family_plot",
    label: "Burial; family plot/cemetery (details below)",
    text: "I prefer burial. Please arrange burial at: ",
  },
  {
    key: "no_preference",
    label: "No strong preference; leave to family/agent",
    text: "I do not have a strong preference. I trust my family/agent to make appropriate arrangements.",
  },
  {
    key: "custom",
    label: "Draft your own",
    text: "",
  },
];

export const distributionWishesPresets: Preset[] = [
  {
    key: "spouse_then_children_equal",
    label: "All to spouse, then equally to children",
    text: "I want everything to pass to my spouse if my spouse survives me. If my spouse does not survive me, I want everything to pass equally to my children.",
  },
  {
    key: "equal_children_no_spouse",
    label: "Equally to children (no spouse share)",
    text: "I want everything to pass equally to my children.",
  },
  {
    key: "custom",
    label: "Draft your own",
    text: "",
  },
];

