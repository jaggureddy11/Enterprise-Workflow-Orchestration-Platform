// services/workflow-service/src/engine/transition-evaluator.ts
// JSONPath expression evaluator for CONDITION steps per PRD §8.3

/**
 * Evaluates a simple JavaScript expression against a context object.
 * Supports: $.context.field comparisons, string equality, numeric comparisons.
 * 
 * Example: "$.context.employee.department === 'ENGINEERING'"
 */
export class TransitionEvaluator {
  evaluate(expression: string, context: Record<string, unknown>): boolean {
    try {
      // Replace JSONPath-style $.context.xxx with context.xxx
      const normalizedExpression = expression.replace(/\$\./g, '');

      // Create a safe evaluation scope
      const scope = { context };

      // Use Function constructor to evaluate in isolated scope
      // In production, use a proper expression evaluator library like expr-eval
      const fn = new Function(...Object.keys(scope), `return (${normalizedExpression})`);
      const result = fn(...Object.values(scope));

      return Boolean(result);
    } catch (error) {
      console.error(`[TransitionEvaluator] Failed to evaluate expression: ${expression}`, error);
      return false; // Default to false branch on evaluation error
    }
  }
}
