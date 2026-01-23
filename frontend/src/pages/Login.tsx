import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Form, Input, Button, Card, App, Typography, theme } from "antd";
import { LanguageToggle } from "@/components/LanguageToggle";

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const onFinish = async (values: { phone: string }) => {
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: values.phone }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(t("login.error.backend"));
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t("login.failed"));
      }

      // Store token in localStorage
      localStorage.setItem("token", data.access_token);
      
      message.success(t("login.success"));
      setLocation("/");
    } catch (error: any) {
      console.error("Login error:", error);
      message.error(error.message || t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: token.colorBgLayout,
      padding: 16,
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageToggle />
      </div>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>{t("login.title")}</Title>
          <Text type="secondary">{t("login.subtitle")}</Text>
        </div>
        
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          disabled={loading}
        >
          <Form.Item
            label={t("login.phoneLabel")}
            name="phone"
            rules={[{ required: true, message: t("login.error.phoneRequired") }]}
          >
            <Input 
              placeholder={t("login.phonePlaceholder")} 
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {loading ? t("login.loggingIn") : t("login.submit")}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
