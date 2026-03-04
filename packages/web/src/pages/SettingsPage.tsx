import { useState } from 'react';
import { Bot, Sliders, Database, Webhook, Info } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { AIConfigSection } from '@/components/settings/AIConfigSection';
import { SynthesisSettingsSection } from '@/components/settings/SynthesisSettingsSection';
import { DataManagementSection } from '@/components/settings/DataManagementSection';
import { WebhookSection } from '@/components/settings/WebhookSection';
import { AboutSection } from '@/components/settings/AboutSection';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

type Section = 'ai' | 'synthesis' | 'data' | 'webhook' | 'about';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI Configuration', icon: <Bot size={16} /> },
  { id: 'synthesis', label: 'Synthesis Settings', icon: <Sliders size={16} /> },
  { id: 'data', label: 'Data Management', icon: <Database size={16} /> },
  { id: 'webhook', label: 'Webhooks & API Keys', icon: <Webhook size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('ai');
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const handleUpdate = (key: string, value: string) => {
    updateMutation.mutate({ [key]: value });
  };

  return (
    <>
      <Topbar title="Settings" />
      <PageContainer>
        <div className="flex gap-6">
          {/* Sidebar nav */}
          <div className="w-52 flex-shrink-0">
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 max-w-2xl">
            <div className="bg-bg-surface border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-text-primary mb-1">
                {SECTIONS.find((s) => s.id === activeSection)?.label}
              </h2>
              <p className="text-xs text-text-muted mb-6">
                {activeSection === 'ai' && 'Configure your OpenAI API key and model preferences.'}
                {activeSection === 'synthesis' && 'Tune the feedback clustering parameters.'}
                {activeSection === 'data' && 'Export or delete all application data.'}
                {activeSection === 'webhook' && 'Manage webhook URL and API key authentication.'}
                {activeSection === 'about' && 'Application version and links.'}
              </p>

              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              ) : (
                <>
                  {activeSection === 'ai' && (
                    <AIConfigSection settings={settings ?? {}} onUpdate={handleUpdate} />
                  )}
                  {activeSection === 'synthesis' && (
                    <SynthesisSettingsSection settings={settings ?? {}} onUpdate={handleUpdate} />
                  )}
                  {activeSection === 'data' && <DataManagementSection />}
                  {activeSection === 'webhook' && <WebhookSection />}
                  {activeSection === 'about' && <AboutSection />}
                </>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
