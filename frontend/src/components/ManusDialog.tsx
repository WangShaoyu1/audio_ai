import { useEffect, useState } from "react";
import { Button, Modal, Typography } from "antd";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;

interface ManusDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function ManusDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: ManusDialogProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  const isOpen = onOpenChange ? open : internalOpen;

  return (
    <Modal
      open={isOpen}
      onCancel={() => handleOpenChange(false)}
      footer={null}
      width={400}
      centered
      styles={{ 
        body: {
          padding: 0, 
          backgroundColor: '#f8f8f7', 
          borderRadius: 20, 
          overflow: 'hidden' 
        }
      }}
      closeIcon={null}
      modalRender={(modal) => (
        <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0px 4px 11px 0px rgba(0,0,0,0.08)' }}>
          {modal}
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 20px 20px' }}>
        {logo && (
          <div style={{ width: 64, height: 64, background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <img src={logo} alt="Dialog graphic" style={{ width: 40, height: 40, borderRadius: 6 }} />
          </div>
        )}

        {title && (
          <Title level={4} style={{ margin: 0, color: '#34322d', fontSize: 20 }}>
            {title}
          </Title>
        )}
        <Text style={{ color: '#858481', fontSize: 14 }}>
          {t('login.manus.title')}
        </Text>
      </div>

      <div style={{ padding: 20 }}>
        <Button
          type="primary"
          block
          onClick={onLogin}
          style={{ 
            height: 40, 
            backgroundColor: '#1a1a19', 
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            border: 'none'
          }}
        >
          {t('login.manus.button')}
        </Button>
      </div>
    </Modal>
  );
}
