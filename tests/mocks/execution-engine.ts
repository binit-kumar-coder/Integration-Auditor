/**
 * Mock execution engine for testing
 */

import { ExecutionAction, ExecutionEngine } from '../../src/planner/execution-planner';

export class MockExecutionEngine implements ExecutionEngine {
  private executedActions: ExecutionAction[] = [];
  private failureRate: number = 0;
  private shouldFailAction?: (action: ExecutionAction) => boolean;
  private executionDelay: number = 0;

  constructor(options: {
    failureRate?: number;
    shouldFailAction?: (action: ExecutionAction) => boolean;
    executionDelay?: number;
  } = {}) {
    this.failureRate = options.failureRate || 0;
    this.shouldFailAction = options.shouldFailAction;
    this.executionDelay = options.executionDelay || 0;
  }

  async executeAction(action: ExecutionAction): Promise<void> {
    // Simulate execution delay
    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    }

    // Check if this action should fail
    const shouldFail = this.shouldFailAction 
      ? this.shouldFailAction(action)
      : Math.random() < this.failureRate;

    if (shouldFail) {
      throw new Error(`Mock execution failure for action ${action.id}: ${action.type}`);
    }

    // Record successful execution
    this.executedActions.push(action);
  }

  getExecutedActions(): ExecutionAction[] {
    return [...this.executedActions];
  }

  getExecutedActionsByType(type: ExecutionAction['type']): ExecutionAction[] {
    return this.executedActions.filter(action => action.type === type);
  }

  getExecutionCount(): number {
    return this.executedActions.length;
  }

  reset(): void {
    this.executedActions = [];
  }

  setFailureRate(rate: number): void {
    this.failureRate = rate;
  }

  setExecutionDelay(delay: number): void {
    this.executionDelay = delay;
  }

  setShouldFailAction(predicate: (action: ExecutionAction) => boolean): void {
    this.shouldFailAction = predicate;
  }
}
