import { useEffect, useRef, useState } from 'react';
import { RANKED_BACKUP_MAX_BYTES } from './ranked-map-backup';
import type { RankedBackupDownload, RankedBackupSnapshot } from './use-ranked-map';

export interface RankedMapBackupControlsProps {
  status?: RankedBackupSnapshot;
  disabled?: boolean;
  protection?: string;
  onExport?: (passphrase: string) => Promise<RankedBackupDownload>;
  onImport?: (raw: string, passphrase: string) => Promise<void>;
}

export function downloadEncryptedMapBackup(backup: RankedBackupDownload): void {
  const url = URL.createObjectURL(new Blob([backup.contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backup.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RankedMapBackupControls({ status = { phase: 'idle' }, disabled = false, protection, onExport, onImport }: RankedMapBackupControlsProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const pending = busy || status.phase === 'exporting' || status.phase === 'importing';
  const locked = disabled || pending;
  const run = async (kind: 'export' | 'import') => {
    if (locked) return;
    setMessage('');
    if (kind === 'export' && passphrase !== confirmation) {
      setMessage('The two backup passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'export') {
        if (!onExport) throw new Error('Backup export is unavailable.');
        const backup = await onExport(passphrase);
        if (mounted.current) downloadEncryptedMapBackup(backup);
      } else {
        if (!file || !onImport) throw new Error('Choose an encrypted map backup file first.');
        if (file.size > RANKED_BACKUP_MAX_BYTES) throw new Error('This backup exceeds the 6 MiB file limit.');
        const raw = await file.text();
        if (!mounted.current) return;
        await onImport(raw, passphrase);
        if (mounted.current) {
          setFile(undefined);
          if (input.current) input.current.value = '';
        }
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'The backup operation failed.');
    } finally {
      if (mounted.current) {
        setPassphrase('');
        setConfirmation('');
        setBusy(false);
      }
    }
  };
  return (
    <details className="ranked-backup-controls">
      <summary>Backup & recovery</summary>
      <p>Save an encrypted copy before changing devices. Restore using the same chain, Season and controller wallet. Imports merge discoveries; Sui remains authoritative.</p>
      {protection !== 'indexeddb-aes-gcm' && <p className="amber-text">This browser is not providing persistent device storage. Keep a portable backup; closing it may lose unexported discoveries.</p>}
      <label>Backup passphrase
        <input type="password" autoComplete="off" spellCheck={false} minLength={16} maxLength={1024}
          value={passphrase} disabled={locked} onChange={(event) => setPassphrase(event.target.value)} />
      </label>
      <p>Use several random words (at least 16 characters), never your wallet recovery phrase. There is no reset if you lose this passphrase.</p>
      <label>Confirm passphrase for export
        <input type="password" autoComplete="off" spellCheck={false} maxLength={1024}
          value={confirmation} disabled={locked} onChange={(event) => setConfirmation(event.target.value)} />
      </label>
      <button type="button" className="button button-secondary compact-button"
        disabled={locked || !onExport || !passphrase || !confirmation} onClick={() => { void run('export'); }}>
        Download encrypted backup
      </button>
      <label>Encrypted map backup file
        <input ref={input} type="file" accept="application/json,.json" disabled={locked}
          onChange={(event) => { setFile(event.target.files?.[0]); setMessage(''); }} />
      </label>
      <button type="button" className="button button-secondary compact-button"
        disabled={locked || !onImport || !file || !passphrase} onClick={() => { void run('import'); }}>
        Restore and merge backup
      </button>
      <div role="status" aria-live="polite">{pending ? 'Processing privately on this device…' : message || status.message}</div>
    </details>
  );
}
