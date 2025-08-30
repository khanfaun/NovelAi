import React, { useState } from 'react';
import type { CharacterStats } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import InfoItemDisplay from './InfoItemDisplay';

interface CharacterPrimaryPanelProps {
  stats: CharacterStats | null;
  isAnalyzing: boolean;
}

type Tab = 'status' | 'realmSystem' | 'inventory' | 'skills' | 'equipment';

const CharacterPrimaryPanel: React.FC<CharacterPrimaryPanelProps> = ({ stats, isAnalyzing }) => {
  const [activeTab, setActiveTab] = useState<Tab>('status');

  const renderContent = () => {
     const hasAnyData = stats && (
        stats.trangThai || stats.canhGioi || stats.heThongCanhGioi?.length ||
        stats.balo?.length || stats.congPhap?.length || stats.trangBi?.length
    );
      
    if (!hasAnyData) {
        if (isAnalyzing) {
             return (
                <div className="flex flex-col items-center justify-center h-48">
                <LoadingSpinner />
                <p className="text-[var(--theme-accent-primary)] mt-2">Đang phân tích chương...</p>
                </div>
            );
        }
      return <p className="text-center text-[var(--theme-text-secondary)] p-6">Chưa có dữ liệu nhân vật.</p>;
    }

    const renderInfoList = (title: string, items?: { ten: string; moTa: string; status?: string }[]) => {
      if (!items || items.length === 0) {
        return <p className="text-[var(--theme-text-secondary)] italic">Chưa có thông tin về {title.toLowerCase()}.</p>;
      }
      return (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
             <InfoItemDisplay key={`${item.ten}-${index}`} item={item} />
          ))}
        </div>
      );
    };
    
    switch(activeTab) {
      case 'status':
        const status = stats.trangThai;
        return (
          <div>
            <h3 className="text-xl font-bold text-[var(--theme-accent-primary)] mb-4">Trạng Thái & Cảnh Giới</h3>
            <div className="space-y-4">
                {status && <p className="text-lg"><strong>Tên:</strong> {status.ten || 'N/A'}</p>}
                 <p className="text-lg">
                    <strong>Cảnh giới:</strong> 
                    <span className="text-2xl ml-2 text-[var(--theme-accent-secondary)] font-semibold">{stats.canhGioi || 'Chưa rõ'}</span>
                </p>
                {status?.tuChat && status.tuChat.length > 0 ? (
                  <div>
                    <h4 className="text-md font-semibold text-[var(--theme-text-secondary)] mb-3">Tư chất / Đặc tính:</h4>
                    <div className="flex flex-col gap-2">
                      {status.tuChat.map((item, index) => (
                        <InfoItemDisplay key={`${item.ten}-${index}`} item={item} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--theme-text-secondary)] italic">Chưa có thông tin về tư chất hoặc đặc tính.</p>
                )}
              </div>
          </div>
        );
      case 'realmSystem':
        return (
          <div>
            <h3 className="text-xl font-bold text-[var(--theme-accent-primary)] mb-4">Hệ Thống Cảnh Giới</h3>
            {stats.heThongCanhGioi && stats.heThongCanhGioi.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {stats.heThongCanhGioi.map((realm, index) => (
                        <InfoItemDisplay 
                            key={index} 
                            item={{ ten: realm, moTa: 'Một cảnh giới trong hệ thống tu luyện của truyện.' }} 
                        />
                    ))}
                </div>
            ) : <p className="text-[var(--theme-text-secondary)] italic">Chưa có thông tin hệ thống cảnh giới.</p>}
          </div>
        );
      case 'inventory':
         return (
          <div>
            <h3 className="text-xl font-bold text-[var(--theme-accent-primary)] mb-4">Balo</h3>
            {renderInfoList('vật phẩm', stats.balo)}
          </div>
        );
      case 'skills':
         return (
          <div>
            <h3 className="text-xl font-bold text-[var(--theme-accent-primary)] mb-4">Công Pháp / Kỹ Năng</h3>
            {renderInfoList('công pháp', stats.congPhap)}
          </div>
        );
      case 'equipment':
        return (
          <div>
            <h3 className="text-xl font-bold text-[var(--theme-accent-primary)] mb-4">Trang Bị</h3>
            {renderInfoList('trang bị', stats.trangBi)}
          </div>
        );
      default:
        return null;
    }
  };

  const TabButton: React.FC<{tab: Tab, label: string, hasContent?: boolean}> = ({ tab, label, hasContent = true }) => (
      <button 
        onClick={() => setActiveTab(tab)}
        disabled={!hasContent}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-[var(--theme-accent-primary)] text-white' : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-base)]'} disabled:text-slate-500 disabled:hover:bg-transparent disabled:cursor-not-allowed`}>
          {label}
      </button>
  );
  
  const panelInnerContent = (
    <>
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h2 className="text-xl font-bold text-[var(--theme-text-primary)] flex items-center">
            Trạng Thái Nhân Vật
            {isAnalyzing && (
                <svg className="animate-spin ml-3 h-5 w-5 text-[var(--theme-accent-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
          </h2>
        </div>
        
        <div className="p-4 flex flex-wrap gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg-base)]/50">
          <TabButton tab="status" label="Trạng Thái" hasContent={!!stats?.trangThai || !!stats?.canhGioi} />
          <TabButton tab="realmSystem" label="Hệ Thống" hasContent={!!stats?.heThongCanhGioi?.length} />
          <TabButton tab="inventory" label="Balo" hasContent={!!stats?.balo?.length}/>
          <TabButton tab="skills" label="Công Pháp" hasContent={!!stats?.congPhap?.length} />
          <TabButton tab="equipment" label="Trang Bị" hasContent={!!stats?.trangBi?.length} />
        </div>
        
        <div className="p-6 min-h-[200px]">
          {renderContent()}
        </div>
    </>
  );
  
  return (
    <div className="bg-[var(--theme-bg-surface)] rounded-lg shadow-xl w-full border border-[var(--theme-border)]">
        {panelInnerContent}
    </div>
  );
};

export default CharacterPrimaryPanel;