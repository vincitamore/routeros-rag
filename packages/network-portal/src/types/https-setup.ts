export interface HTTPSSetupRecommendation {
  canUpgrade: boolean;
  reason: string;
  currentPort?: number;
  recommendedPort?: number;
  sshAvailable?: boolean;
  sshDiagnostics?: {
    connectionAttempted: boolean;
    connectionError?: string;
    possibleIssues: string[];
    suggestedFixes: string[];
  };
}

export interface HTTPSSetupProgress {
  currentStep: number;
  totalSteps: number;
  message: string;
  isComplete: boolean;
}

export interface HTTPSSetupState {
  isProcessing: boolean;
  currentStep: number;
  error: string | null;
  success: boolean;
}

export interface HTTPSSetupDevice {
  device: {
    id: string;
    name: string;
    ipAddress: string;
    port: number;
    username: string;
    password: string;
    useSSL: boolean;
  };
  recommendation: HTTPSSetupRecommendation;
} 