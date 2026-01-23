import { useEffect, useState } from "react";
import { Modal } from "antd";
import { useLocation } from "wouter";

export default function SessionExpiredHandler() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

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
      title="登录已过期"
      open={open}
      onOk={handleLogin}
      closable={false}
      maskClosable={false}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText="重新登录"
      centered
    >
      <p>您的登录会话已过期，请重新登录以继续使用。</p>
    </Modal>
  );
}
