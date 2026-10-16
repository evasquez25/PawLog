import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () =>
      setInstalled(
        media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    update();
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    media.addEventListener('change', update);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
      media.removeEventListener('change', update);
    };
  }, []);
  return (
    <section className="settings-card">
      <h2>PawLog on your home screen</h2>
      {installed ? (
        <p className="subtext">You’re using the installed app. Happy caring!</p>
      ) : (
        <>
          <p className="subtext">Keep your care crew a tap away.</p>
          {prompt && (
            <Button
              className="mt-4 min-h-11"
              onClick={async () => {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
              }}
            >
              Install PawLog
            </Button>
          )}
          <p className="field-hint">
            On iPhone or iPad: open PawLog in Safari, tap Share, then Add to Home Screen. On
            Android: open it in Chrome and choose Install app or Add to Home screen from the menu.
            Desktop browsers may show an install icon in the address bar.
          </p>
        </>
      )}
      <p className="field-hint">
        An internet connection is needed to load current household care and save changes. Nothing is
        queued to save offline.
      </p>
    </section>
  );
}
