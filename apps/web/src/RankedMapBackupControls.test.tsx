import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RankedMapBackupControls, downloadEncryptedMapBackup } from './RankedMapBackupControls';
import { RANKED_BACKUP_MAX_BYTES } from './ranked-map-backup';

const passphrase = 'test-only private map passphrase';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('portable backup controls', () => {
  it('downloads only the encrypted contents and revokes the temporary object URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:private-backup-test');
    const revokeObjectURL = vi.fn();
    const BaseURL = URL;
    vi.stubGlobal('URL', class extends BaseURL {
      static override createObjectURL = createObjectURL;
      static override revokeObjectURL = revokeObjectURL;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('private-map.json');
      expect(this.href).toBe('blob:private-backup-test');
    });
    downloadEncryptedMapBackup({ filename: 'private-map.json', contents: 'authenticated-encrypted-envelope' });
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:private-backup-test');
  });
  it('requires matching confirmation for export and clears secrets after failure', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockRejectedValue(new Error('Unable to encrypt.'));
    render(<RankedMapBackupControls onExport={onExport} protection="indexeddb-aes-gcm" />);
    await user.click(screen.getByText('Backup & recovery'));
    await user.type(screen.getByLabelText('Backup passphrase'), passphrase);
    await user.type(screen.getByLabelText('Confirm passphrase for export'), `${passphrase} typo`);
    await user.click(screen.getByRole('button', { name: 'Download encrypted backup' }));
    expect(onExport).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/do not match/);
    await user.clear(screen.getByLabelText('Confirm passphrase for export'));
    await user.type(screen.getByLabelText('Confirm passphrase for export'), passphrase);
    await user.click(screen.getByRole('button', { name: 'Download encrypted backup' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unable to encrypt.'));
    expect(screen.getByLabelText('Backup passphrase')).toHaveValue('');
    expect(screen.getByLabelText('Confirm passphrase for export')).toHaveValue('');
  });

  it('reads an encrypted file locally, passes exact contents and clears it after merge', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<RankedMapBackupControls onImport={onImport} />);
    await user.click(screen.getByText('Backup & recovery'));
    expect(screen.getByText(/not providing persistent device storage/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Backup passphrase'), passphrase);
    const file = new File(['encrypted-test-envelope'], 'private-map.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => 'encrypted-test-envelope' });
    await user.upload(screen.getByLabelText('Encrypted map backup file'), file);
    await user.click(screen.getByRole('button', { name: 'Restore and merge backup' }));
    await waitFor(() => expect(onImport).toHaveBeenCalledExactlyOnceWith('encrypted-test-envelope', passphrase));
    expect(screen.getByLabelText('Backup passphrase')).toHaveValue('');
    expect(screen.getByLabelText('Encrypted map backup file')).toHaveValue('');
  });

  it('rejects an oversized file before reading it or invoking restore', async () => {
    const onImport = vi.fn();
    render(<RankedMapBackupControls onImport={onImport} />);
    fireEvent.click(screen.getByText('Backup & recovery'));
    fireEvent.change(screen.getByLabelText('Backup passphrase'), { target: { value: passphrase } });
    const text = vi.fn();
    const file = new File([], 'oversized.json', { type: 'application/json' });
    Object.defineProperties(file, { size: { value: RANKED_BACKUP_MAX_BYTES + 1 }, text: { value: text } });
    fireEvent.change(screen.getByLabelText('Encrypted map backup file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore and merge backup' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/6 MiB/));
    expect(text).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('does not continue a late file read after its Seat-specific panel unmounts', async () => {
    const onImport = vi.fn();
    let finish!: (raw: string) => void;
    const file = new File([], 'late.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve) => { finish = resolve; }) });
    const { unmount } = render(<RankedMapBackupControls onImport={onImport} />);
    fireEvent.click(screen.getByText('Backup & recovery'));
    fireEvent.change(screen.getByLabelText('Backup passphrase'), { target: { value: passphrase } });
    fireEvent.change(screen.getByLabelText('Encrypted map backup file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore and merge backup' }));
    unmount();
    finish('encrypted-test-envelope');
    await Promise.resolve();
    expect(onImport).not.toHaveBeenCalled();
  });
});
