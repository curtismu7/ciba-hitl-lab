export const POLICY_LABELS = { allow: "Allow", stepup: "Step-up", deny: "Deny" };
export const POLICY_DETAIL = {
  allow: "Below the step-up line: proceed, still subject to the policy engine.",
  stepup: "Between the lines: require MFA or human consent before executing.",
  deny: "At or above the deny line: refuse and log, never reach the tool.",
};
