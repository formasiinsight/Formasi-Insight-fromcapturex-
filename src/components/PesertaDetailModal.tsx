import React from 'react';
import { FormasiDetailPage, FormasiDetailPageProps } from './FormasiDetailPage';

export interface PesertaDetailModalProps {
  formasi: FormasiDetailPageProps['formasi'];
  instansiNama: string;
  instansiId?: string;
  onClose: () => void;
  onUpdatePesertaList: FormasiDetailPageProps['onUpdatePesertaList'];
}

export const PesertaDetailModal: React.FC<PesertaDetailModalProps> = ({
  formasi,
  instansiNama,
  instansiId,
  onClose,
  onUpdatePesertaList,
}) => {
  if (!formasi) return null;

  return (
    <FormasiDetailPage
      formasi={formasi}
      instansiNama={instansiNama}
      instansiId={instansiId}
      onBack={onClose}
      onUpdatePesertaList={onUpdatePesertaList}
    />
  );
};

