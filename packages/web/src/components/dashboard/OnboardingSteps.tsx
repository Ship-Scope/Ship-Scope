import { Check, Upload, Brain, Lightbulb, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStepsProps {
  feedbackCount: number;
  themeCount: number;
  proposalCount: number;
  specCount: number;
}

export function OnboardingSteps({
  feedbackCount,
  themeCount,
  proposalCount,
  specCount,
}: OnboardingStepsProps) {
  const navigate = useNavigate();

  const getStatus = (
    count: number,
    prevCompleted: boolean,
  ): 'completed' | 'current' | 'pending' => {
    if (count > 0) return 'completed';
    if (prevCompleted) return 'current';
    return 'pending';
  };

  const step1Complete = feedbackCount > 0;
  const step2Complete = themeCount > 0;
  const step3Complete = proposalCount > 0;
  const step4Complete = specCount > 0;

  const steps = [
    {
      id: 1,
      title: 'Import Feedback',
      description: 'Upload a CSV or JSON file, or add feedback manually.',
      icon: <Upload size={18} />,
      status: getStatus(feedbackCount, true),
      completedText: step1Complete
        ? `${feedbackCount.toLocaleString()} feedback items imported`
        : undefined,
      actionLabel: 'Import',
      path: '/feedback',
    },
    {
      id: 2,
      title: 'Run Synthesis',
      description: 'Analyze feedback to discover themes and sentiment patterns.',
      icon: <Brain size={18} />,
      status: getStatus(themeCount, step1Complete),
      completedText: step2Complete ? `${themeCount} themes discovered` : undefined,
      actionLabel: 'Run Synthesis',
      path: '/themes',
    },
    {
      id: 3,
      title: 'Generate Proposals',
      description: 'Create prioritized feature proposals with RICE scoring.',
      icon: <Lightbulb size={18} />,
      status: getStatus(proposalCount, step2Complete),
      completedText: step3Complete ? `${proposalCount} proposals generated` : undefined,
      actionLabel: 'Generate',
      path: '/proposals',
    },
    {
      id: 4,
      title: 'Create Specs',
      description: 'Generate PRDs and agent-ready development prompts.',
      icon: <FileText size={18} />,
      status: getStatus(specCount, step3Complete),
      completedText: step4Complete ? `${specCount} specs created` : undefined,
      actionLabel: 'View Proposals',
      path: '/proposals',
    },
  ];

  const completedCount = [step1Complete, step2Complete, step3Complete, step4Complete].filter(
    Boolean,
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Getting Started
        </h3>
        <span className="text-xs font-mono text-text-muted">{completedCount}/4 completed</span>
      </div>

      <div className="h-1 bg-bg-surface-2 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-accent-blue rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex gap-4">
            {index < steps.length - 1 && (
              <div className="absolute left-[15px] top-[32px] w-[2px] h-[calc(100%-8px)]">
                <div
                  className={`w-full h-full ${
                    step.status === 'completed' ? 'bg-accent-blue' : 'bg-border'
                  }`}
                />
              </div>
            )}

            <div className="flex-shrink-0 relative z-10">
              {step.status === 'completed' ? (
                <div className="w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center">
                  <Check size={16} className="text-white" />
                </div>
              ) : step.status === 'current' ? (
                <div className="w-8 h-8 rounded-full border-2 border-accent-blue bg-accent-blue/10 flex items-center justify-center">
                  <span className="text-accent-blue">{step.icon}</span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-border bg-bg-surface flex items-center justify-center">
                  <span className="text-text-muted">{step.icon}</span>
                </div>
              )}
            </div>

            <div className="flex-1 pb-8">
              <div className="flex items-center justify-between">
                <h4
                  className={`text-sm font-medium ${
                    step.status === 'pending' ? 'text-text-muted' : 'text-text-primary'
                  }`}
                >
                  Step {step.id}: {step.title}
                </h4>
                {step.status !== 'pending' && (
                  <button
                    onClick={() => navigate(step.path)}
                    className={`text-xs font-medium px-3 py-1 rounded-md transition-all ${
                      step.status === 'current'
                        ? 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {step.status === 'completed' ? 'View' : step.actionLabel}
                  </button>
                )}
              </div>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  step.status === 'pending' ? 'text-text-muted' : 'text-text-secondary'
                }`}
              >
                {step.description}
              </p>
              {step.completedText && (
                <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                  <Check size={12} />
                  {step.completedText}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
