
/**
 * FIRST PRINCIPLES THINKING (FPT) ENGINE CONTENT
 * 
 * This file contains the educational research content and the system prompts
 * used to enforce the FPT framework across the application.
 */

export const FPT_SYSTEM_PROMPT = `
### FPT-OMEGA ENGINE ACTIVATED ###

You are strictly operating under the First Principles Thinking (FPT) protocol.
You must NOT reason by analogy ("how it's usually done"). 
You must reason by physics/logic ("what is fundamentally true").

**MANDATORY OUTPUT FORMAT:**
You must return a JSON object. Do not return plain text.

Structure:
{
  "deconstruction": ["List of complex concepts broken down", "Assumptions identified and stripped"],
  "assumptionsRemoved": ["List of analogies or 'common wisdom' you rejected"],
  "axioms": ["The fundamental, non-negotiable truths remaining"],
  "reconstruction": "The final answer/solution built UP from the axioms."
}

**LOGIC RULES:**
1. DECONSTRUCT: Break the problem down to its smallest atomic parts.
2. VERIFY: Question every assumption. If it's not a law of physics or logic, it's an assumption.
3. RECONSTRUCT: Build the solution from the ground up using only the verified axioms.
`;

export const FPT_RESEARCH_DATA = {
  title: "FPT-Omega: The Logic of Sovereignty",
  sections: [
    {
      heading: "1. The Philosophy of Deduction",
      content: "First Principles Thinking (FPT) is a mode of inquiry that relentlessly pursues the foundational 'atoms' of truth. Unlike 'Reasoning by Analogy', which builds upon existing assumptions and 'best practices', FPT strips away all acquired knowledge until only the indisputable facts remain. It is the physics of intellect."
    },
    {
      heading: "2. The Cost of Analogy",
      content: "95% of human thought is analogical. We do things because 'that's how they are done'. This creates a 'Derivative Efficiency'—we optimize existing systems rather than inventing new ones. FPT creates 'Fundamental Efficiency'. By rejecting the analogy, we escape the limitations of the current paradigm."
    },
    {
      heading: "3. The Quanta Engine Protocol",
      content: "The FPT-Omega Engine in this application enforces a strict 3-step neural pathway:\n\nA. DECONSTRUCTION: The query is exploded into component parts. Cultural bias is flagged as 'Noise'.\n\nB. AXIOM ISOLATION: We search for the 'Non-Negotiables'—math, physics, code, or verified data.\n\nC. RECONSTRUCTION: The solution is compiled solely from these axioms, often resulting in novel, non-obvious strategies."
    },
    {
      heading: "4. Auditable Intelligence",
      content: "Sovereign Intelligence requires trust. The Quanta FPT Engine provides a transparent 'Audit Trace' for every major decision. You can see exactly which assumptions were discarded and which axioms formed the bedrock of the advice. This ensures the AI serves your specific reality, not a generalized average."
    }
  ]
};
