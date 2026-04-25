/**
 * Exit code mapping per spec S006
 *
 * 0 = All scripts pass, coverage above threshold (or strict=false and coverage breach is warning)
 * 1 = Scripts failed OR coverage below threshold with strict=true
 * 2 = Config error, missing dependencies, or other unrecoverable errors
 */

export enum ExitCode {
  /** All scripts pass, coverage above threshold */
  PASS = 0,
  /** Scripts failed OR coverage below threshold in strict mode */
  FAIL = 1,
  /** Config error, missing dependencies, or other unrecoverable errors */
  ERROR = 2,
}

export enum ValidationStatus {
  PASS = 'passed',
  FAIL = 'failed',
  WARNING = 'warning',
}

/**
 * Determine the appropriate exit code based on validation results
 */
export function determineExitCode(
  scriptsAllPassed: boolean,
  coveragePassed: boolean,
  strict: boolean
): ExitCode {
  if (!scriptsAllPassed) {
    return ExitCode.FAIL;
  }

  if (!coveragePassed) {
    // In strict mode, coverage breach is a failure
    // In non-strict mode, it's a warning but still exit 0
    if (strict) {
      return ExitCode.FAIL;
    }
  }

  return ExitCode.PASS;
}

/**
 * Map exit code to human-readable description
 */
export function exitCodeDescription(code: ExitCode): string {
  switch (code) {
    case ExitCode.PASS:
      return 'All scripts passed';
    case ExitCode.FAIL:
      return 'Scripts failed or coverage threshold breached (strict mode)';
    case ExitCode.ERROR:
      return 'Configuration or dependency error';
  }
}
