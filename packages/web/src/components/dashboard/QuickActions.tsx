import { useNavigate } from 'react-router-dom';
import { Upload, Brain, Lightbulb, Blocks } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Import Feedback',
      description: 'Upload CSV, JSON, or from Jira',
      icon: <Upload size={20} />,
      onClick: () => navigate('/feedback'),
    },
    {
      label: 'Run Synthesis',
      description: 'Discover themes from feedback',
      icon: <Brain size={20} />,
      onClick: () => navigate('/themes'),
    },
    {
      label: 'Generate Proposals',
      description: 'Create proposals from themes',
      icon: <Lightbulb size={20} />,
      onClick: () => navigate('/proposals'),
    },
    {
      label: 'Jira Integration',
      description: 'Export, sync & import from Jira',
      icon: <Blocks size={20} />,
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-surface border border-border hover:border-accent-blue hover:bg-accent-blue/5 transition-all group"
        >
          <div className="text-text-muted group-hover:text-accent-blue transition-colors">
            {action.icon}
          </div>
          <span className="text-sm font-medium text-text-primary">{action.label}</span>
          <span className="text-xs text-text-muted">{action.description}</span>
        </button>
      ))}
    </div>
  );
}
