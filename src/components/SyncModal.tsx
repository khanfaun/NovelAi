import React, { useState, useEffect } from 'react';
import * as driveSync from '@/services/sync';
import { CloseIcon, SpinnerIcon } from './icons';
import type { GoogleUser } from '@/types';

interface SyncModalProps {
  onClose: () => void;
  onSync: () => Promise<boolean>;
}

const SyncModal: React.FC<SyncModalProps> = ({ onClose, onSync }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [status, setStatus] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const updateState = () => {
        const signedIn = driveSync.isSignedIn();
        setIsSignedIn(signedIn);
        setUser(signedIn ? driveSync.getCurrentUser() : null);
    };
    driveSync.listenToAuthChanges(updateState);
    updateState(); // Initial check
  }, []);

  const handleSignIn = async () => {
    setIsWorking(true);
    setStatus('Đang mở cửa sổ đăng nhập Google...');
    try {
      await driveSync.signIn();
      // Auth listener will update state
      setStatus('Đăng nhập thành công! Đang đồng bộ...');
      await onSync();
      setStatus('Đồng bộ hoàn tất!');
    } catch (error: any) {
      if (error.error === 'popup_closed_by_user') {
        setStatus('Cửa sổ đăng nhập đã bị đóng.');
      } else {
        setStatus('Đăng nhập thất bại. Vui lòng thử lại.');
        console.error("Sign-in error", error);
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleSignOut = () => {
    driveSync.signOut();
    setStatus('Đã đăng xuất.');
  };

  const handleSyncNow = async () => {
    setIsWorking(true);
    setStatus('Đang đồng bộ hóa dữ liệu...');
    const success = await onSync();
    if (success) {
      setStatus('Đồng bộ thành công!');
    } else {
      setStatus('Đồng bộ thất bại. Vui lòng thử lại.');
    }
    setIsWorking(false);
  };

  return (
    <div className="sync-modal-overlay animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sync-modal animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="sync-modal__header">
          <h2 id="sync-modal-title" className="sync-modal__title">Đồng bộ với Google Drive</h2>
          <button onClick={onClose} className="sync-modal__close-btn" aria-label="Đóng">
            <CloseIcon className="sync-modal__close-icon" />
          </button>
        </header>

        <div className="p-6">
          {isSignedIn && user ? (
            <div className="text-center">
              <img src={user.imageUrl} alt="User avatar" className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-[var(--theme-accent-primary)]" />
              <p className="font-semibold text-lg text-[var(--theme-text-primary)]">{user.name}</p>
              <p className="text-sm text-[var(--theme-text-secondary)] mb-6">{user.email}</p>
              <div className="flex flex-col gap-3">
                <button
                    onClick={handleSyncNow}
                    className="sync-modal-form__button sync-modal-form__button--primary"
                    disabled={isWorking}
                >
                  {isWorking ? <SpinnerIcon className="sync-modal-form__spinner" /> : 'Đồng bộ hóa ngay'}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="sync-modal-form__button sync-modal-form__button--secondary"
                  disabled={isWorking}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="sync-modal__description text-center">
                Đăng nhập bằng tài khoản Google của bạn để lưu và đồng bộ lịch sử đọc, dữ liệu AI trên mọi thiết bị.
              </p>
              <button
                onClick={handleSignIn}
                disabled={isWorking}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors duration-300"
              >
                 {isWorking ? <SpinnerIcon className="sync-modal-form__spinner" /> : (
                     <>
                        <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#clip0_17_40)"><path fill="#4285F4" d="M43.611 20.083H42V20H24V28H35.303C33.6747 33.148 29.2287 37.001 24 37C17.373 37 12 31.627 12 25C12 18.373 17.373 13 24 13C26.96 13 29.56 14.14 31.63 15.87L37.18 10.32C33.4725 6.94524 28.9375 5.00195 24 5C13.464 5 5 13.464 5 24C5 34.536 13.464 43 24 43C34.536 43 43 34.536 43 24C43 22.663 42.871 21.35 42.611 20.083V20.083Z"></path><path fill="#EA4335" d="M31.63 15.87L24 22.88L37.18 10.32C33.4725 6.94524 28.9375 5.00195 24 5V13C26.96 13 29.56 14.14 31.63 15.87Z"></path><path fill="#34A853" d="M24 43C28.9375 42.998 33.4725 41.0548 37.18 37.68L31.63 32.13C29.56 33.86 26.96 35 24 35C21.04 35 18.44 33.86 16.37 32.13L10.82 37.68C14.5275 41.0548 19.0625 42.998 24 43V43Z"></path><path fill="#FBBC05" d="M42.611 20.083H24V28H35.303C34.51 30.245 33.16 32.068 31.63 32.13L37.18 37.68C40.6552 34.4172 42.6625 30.0125 42.962 25.083C43.001 24.524 43 23.5 43 23C43 22.663 42.871 21.35 42.611 20.083V20.083Z"></path></g><defs><clipPath id="clip0_17_40"><rect width="48" height="48" fill="white"></rect></clipPath></defs></svg>
                        <span>Đăng nhập với Google</span>
                     </>
                 )}
              </button>
            </div>
          )}
        </div>

        <div className="sync-modal__status" aria-live="polite">
          {status}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
