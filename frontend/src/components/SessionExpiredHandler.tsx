import { useEffect, useState } from "react";
import { Modal } from "antd";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function SessionExpiredHandler() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const handleUnauthorized = () => {
      setOpen(true);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const handleLogin = () => {
    setOpen(false);
    localStorage.removeItem("token");
    setLocation("/login");
  };

  return (
    <Modal
      title={t('login.expired.title')}
      open={open}
      onOk={handleLogin}
      closable={false}
      maskClosable={false}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText={t('login.expired.button')}
      centered
    >
      <p>{t('login.expired.message')}</p>
    </Modal>
  );
}
